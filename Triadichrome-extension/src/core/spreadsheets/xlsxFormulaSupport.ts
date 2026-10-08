import ExcelJS from "exceljs";
import JSZip from "jszip";

type Support = { columns: Map<string, Record<string, string>>; spills: Map<number, Set<string>>; names: Record<string, string> };
const support = new WeakMap<ExcelJS.Workbook, Support>();
function state(wb: ExcelJS.Workbook): Support {
  let data = support.get(wb);
  if (!data) { data = { columns: new Map(), spills: new Map(), names: {} }; support.set(wb, data); }
  return data;
}

/** Office Open XML uses future-function and LAMBDA parameter prefixes. */
export function excelFormula(formula: string): string {
  return formula.replace(/\s*\n\s*/g, "")
    .replace(/\b(FILTER)\(/g, "_xlfn._xlws.$1(")
    .replace(/\b(LET|LAMBDA|MAP|REDUCE|VSTACK|SEQUENCE|SORTBY|XLOOKUP|XMATCH|IFNA)\(/g, "_xlfn.$1(")
    .replace(/\bp[A-Z][A-Za-z]+\b/g, name => `_xlpm.${name}`);
}
export function defineFormula(wb: ExcelJS.Workbook, name: string, formula: string) {
  // ExcelJS definedNames.add() accepts cell locations only. Names containing formulas
  // are emitted at serialization rather than being parsed as invalid cell addresses.
  state(wb).names[name] = excelFormula(formula);
}
export function calculatedColumns(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, tableName: string, formulas: Record<string, string>) {
  const data = Object.fromEntries(Object.entries(formulas).map(([name, formula]) => [name, excelFormula(formula)]));
  state(wb).columns.set(tableName, data);
  const headers = ws.getRow(3);
  for (const [name, expression] of Object.entries(data)) {
    let col = 0; headers.eachCell((cell, index) => { if (cell.value === name) col = index; });
    if (!col) throw new Error(`計算列が見つかりません：${tableName}[${name}]`);
    for (let row = 4; row <= ws.rowCount; row++) {
      ws.getCell(row, col).value = { formula: expression };
      ws.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
    }
  }
}
export function spillColumn(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, row: number, col: number, expression: string, values: (string | number | null)[]) {
  const cached = values.length ? values : [""];
  cached.forEach((value, index) => { ws.getCell(row + index, col).value = value; });
  const anchor = ws.getCell(row, col);
  const array: ExcelJS.CellFormulaValue & { shareType: "array"; ref: string } = { formula: excelFormula(expression), result: cached[0] ?? "", shareType: "array", ref: `${anchor.address}:${ws.getCell(row + cached.length - 1, col).address}` };
  anchor.value = array;
  const data = state(wb); if (!data.spills.has(ws.id)) data.spills.set(ws.id, new Set());
  data.spills.get(ws.id)!.add(anchor.address);
}
export function registerCalculation(wb: ExcelJS.Workbook) { state(wb); }

const xml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const metadata = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray"><metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes><futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}"><xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata><cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>';

/** Add the Excel-native features ExcelJS 4.4 does not serialize: growing table
 * calculation columns, formula names, and dynamic-array cell metadata. */
export async function serializeWithFormulaSupport(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const bytes = await wb.xlsx.writeBuffer();
  const data = support.get(wb);
  if (!data) return new Uint8Array(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const book = zip.file("xl/workbook.xml");
  if (!book) throw new Error("Excelブックの構造が見つかりません。");
  let bookXml = await book.async("string");
  const definedNames = Object.entries(data.names).map(([name, formula]) => `<definedName name="${xml(name)}">${xml(formula)}</definedName>`).join("");
  bookXml = bookXml.includes("</definedNames>") ? bookXml.replace("</definedNames>", `${definedNames}</definedNames>`) : bookXml.replace("<calcPr", `<definedNames>${definedNames}</definedNames><calcPr`);
  bookXml = bookXml.replace(/<calcPr\b([^>]*)\/>/, (_, attrs: string) => `<calcPr${attrs.replace(/\s(?:calcMode|forceFullCalc)="[^"]*"/g, "")} calcMode="auto" forceFullCalc="1"/>`);
  zip.file("xl/workbook.xml", bookXml);
  for (const file of Object.values(zip.files).filter(f => /^xl\/tables\/table\d+\.xml$/.test(f.name))) {
    let text = await file.async("string");
    const tableName = text.match(/<table\b[^>]*\bname="([^"]+)"/)?.[1];
    const columns = tableName ? data.columns.get(tableName) : undefined;
    if (!columns) continue;
    text = text.replace(/<tableColumn\b([^>]*?)(?:\/>|>([\s\S]*?)<\/tableColumn>)/g, (original, attrs: string, child: string | undefined) => {
      const name = attrs.match(/\bname="([^"]+)"/)?.[1];
      const formula = name ? columns[name] : undefined;
      return formula ? `<tableColumn${attrs}><calculatedColumnFormula>${xml(formula)}</calculatedColumnFormula>${child ?? ""}</tableColumn>` : original;
    });
    zip.file(file.name, text);
  }
  if (data.spills.size) {
    zip.file("xl/metadata.xml", metadata);
    const types = zip.file("[Content_Types].xml")!;
    zip.file(types.name, (await types.async("string")).replace("</Types>", '<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/></Types>'));
    const rels = zip.file("xl/_rels/workbook.xml.rels")!;
    zip.file(rels.name, (await rels.async("string")).replace("</Relationships>", '<Relationship Id="rIdDynamicArrays" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata" Target="metadata.xml"/></Relationships>'));
    // ExcelJS filenames retain worksheet ids even after changing the tab order.
    for (const ws of wb.worksheets) {
      const addresses = data.spills.get(ws.id); if (!addresses) continue;
      const file = zip.file(`xl/worksheets/sheet${ws.id}.xml`)!;
      zip.file(file.name, (await file.async("string")).replace(/<c\b([^>]*?)>/g, (original, attrs: string) => {
        const address = attrs.match(/\br="([^"]+)"/)?.[1];
        return address && addresses.has(address) ? `<c${attrs} cm="1">` : original;
      }));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
