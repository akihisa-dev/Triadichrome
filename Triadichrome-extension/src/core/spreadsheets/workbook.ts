import ExcelJS from "exceljs";
import { initiativeMonths } from "../domain/calendar";
import { amountToYen, yenToAmount } from "../domain/amounts";
export type { PreviousPatch } from "../domain/kinds";
import type { PreviousPatch } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";

export { createReportWorkbook } from "./reportWorkbook";
export type { ExportTable, ExportOptions } from "./reportWorkbook";
import { serializeWithFormulaSupport } from "./xlsxFormulaSupport";
export type PreviousPair = { industryId: number; departmentId: number };
const amountFormat = '[>=0.5]#,##0;[<=-0.5]-#,##0;""';
const font = { name: "Yu Gothic", size: 10, color: { argb: "FF202020" } };
const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF3F3F3" } };
const border = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
function sheet(workbook: ExcelJS.Workbook, name: string, widths: number[], headers: number, frozen: number) {
  const ws = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: frozen, ySplit: headers + 2 }] });
  widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
  ws.getCell(1, 1).value = name;
  ws.getCell(1, 1).font = { ...font, size: 14, bold: true };
  return ws;
}
function finish(ws: ExcelJS.Worksheet, headerEnd: number, shaded: Set<number> = new Set()) {
  for (let r = 3; r <= ws.rowCount; r++) {
    ws.getRow(r).height = 21;
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { ...font, bold: r <= headerEnd || shaded.has(r) };
      cell.border = { top: border, bottom: border, left: border, right: border };
      cell.alignment = { vertical: "middle", horizontal: r <= headerEnd ? "center" : typeof cell.value === "string" ? "left" : "right", wrapText: c === 1 || c === 2 };
      if (r <= headerEnd || shaded.has(r)) cell.fill = fill;
      if (r > headerEnd && !cell.numFmt) cell.numFmt = amountFormat;
    }
  }
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${headerEnd}` };
}
function workbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Triadichrome";
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

const metaName = "_triadichrome";
export function createPreviousWorkbook(contents: PlanContents, pairs: PreviousPair[]): ExcelJS.Workbook {
  if (!pairs.length || new Set(pairs.map(p => `${p.industryId}:${p.departmentId}`)).size !== pairs.length) throw new Error("業種・部署の組み合わせを選択してください。");
  const wb = workbook();
  const meta = wb.addWorksheet(metaName, { state: "veryHidden" });
  meta.addRow(["Triadichrome previous v1", contents.fiscalYear]);
  meta.addRow(["シート", "業種ID", "部署ID", "科目ID", "科目コード", "科目名", ...initiativeMonths]);
  pairs.forEach((pair, index) => {
    const industry = contents.industries.find(i => i.id === pair.industryId);
    const department = contents.departments.find(d => d.id === pair.departmentId);
    if (!industry || !department) throw new Error("業種・部署が見つかりません。");
    const name = `${index + 1}_${industry.industryName}_${department.departmentName}`.replace(/[\\/*?:\[\]]/g, "_").slice(0, 31);
    const ws = sheet(wb, name, [14, 30, ...initiativeMonths.map(() => 14)], 1, 2);
    ws.getCell("A1").value = "前年入力";
    ws.getCell("A2").value = `${contents.fiscalYear}年度 · ${industry.industryName} · ${department.departmentName} · 単位：千円`;
    ws.addRow(["科目コード", "科目名", ...initiativeMonths.map(m => `${m}月`)]);
    contents.accounts.forEach(account => {
      const amounts = initiativeMonths.map(m => contents.previousAmounts.find(p => p.industryId === pair.industryId && p.departmentId === pair.departmentId && p.accountId === account.id && p.month === m)?.amount ?? "0");
      ws.addRow([account.accountCode, account.accountName, ...amounts.map(Number)]);
      meta.addRow([name, pair.industryId, pair.departmentId, account.id, account.accountCode, account.accountName, ...amounts]);
    });
    finish(ws, 3);
    ws.columns.slice(2).forEach(col => { col.numFmt = '#,##0.###;-#,##0.###;0'; });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: ws.rowCount, column: 14 } };
    (ws as ExcelJS.Worksheet & { orderNo: number }).orderNo = index;
  });
  (meta as ExcelJS.Worksheet & { orderNo: number }).orderNo = pairs.length;
  return wb;
}

export function readPreviousWorkbook(wb: ExcelJS.Workbook, contents: PlanContents): PreviousPatch[] {
  const meta = wb.getWorksheet(metaName);
  if (!meta || meta.getCell("A1").value !== "Triadichrome previous v1" || meta.getCell("B1").value !== contents.fiscalYear) throw new Error("この年度の前年入力フォーマットを選択してください。");
  if (meta.rowCount > 100000) throw new Error("取り込み件数が多すぎます。");
  const patches: PreviousPatch[] = [];
  const keys = new Set<string>();
  const sheets = new Map<string, { pair: PreviousPair; count: number }>();
  const fail = (message: string) => { throw new Error(message); };
  for (let r = 3; r <= meta.rowCount; r++) {
    const name = meta.getCell(r, 1).value;
    const industryId = meta.getCell(r, 2).value;
    const departmentId = meta.getCell(r, 3).value;
    const accountId = meta.getCell(r, 4).value;
    if (typeof name !== "string" || typeof industryId !== "number" || typeof departmentId !== "number" || typeof accountId !== "number") fail("管理情報が正しくありません。");
    const pair = { industryId: industryId as number, departmentId: departmentId as number };
    const account = contents.accounts.find(a => a.id === accountId);
    if (!account || account.accountCode !== meta.getCell(r, 5).value || account.accountName !== meta.getCell(r, 6).value || !contents.industries.some(i => i.id === industryId) || !contents.departments.some(d => d.id === departmentId)) fail("出力後にマスタが変更されています。フォーマットを出力し直してください。");
    const ws = wb.getWorksheet(name as string);
    if (!ws) fail("前年入力シートが見つかりません。");
    if (ws!.getCell("A1").value !== "前年入力" || ws!.getCell("A3").value !== "科目コード" || ws!.getCell("B3").value !== "科目名") fail("フォーマットの見出しを変更しないでください。");
    const existing = sheets.get(name as string);
    if (existing && (existing.pair.industryId !== industryId || existing.pair.departmentId !== departmentId)) fail("シートの組み合わせが正しくありません。");
    const count = (existing?.count ?? 0) + 1;
    sheets.set(name as string, { pair, count });
    const row = count + 3;
    if (ws!.getCell(row, 1).value !== account!.accountCode || ws!.getCell(row, 2).value !== account!.accountName) fail("科目コード・科目名・行順を変更せず、金額だけ編集してください。");
    initiativeMonths.forEach((month, mi) => {
      if (ws!.getCell(3, mi + 3).value !== `${month}月`) fail("月の見出しを変更しないでください。");
      const key = `${industryId}:${departmentId}:${accountId}:${month}`;
      if (keys.has(key)) fail("同じ業種・部署・科目・月が重複しています。"); keys.add(key);
      const value = ws!.getCell(row, mi + 3).value;
      if (value === null || value === "") return;
      if (typeof value !== "number" && typeof value !== "string") fail(`${name} ${ws!.getCell(row, mi + 3).address}：数式を使わず金額を入力してください。`);
      let after: string;
      try { after = yenToAmount(amountToYen(String(value))); } catch { return fail(`${name} ${ws!.getCell(row, mi + 3).address}：千円単位・小数点以下3桁までの金額を入力してください。`); }
      const original = String(meta.getCell(r, mi + 7).value);
      const before = contents.previousAmounts.find(p => p.industryId === industryId && p.departmentId === departmentId && p.accountId === accountId && p.month === month)?.amount ?? "0";
      if (amountToYen(before) !== amountToYen(original)) fail("出力後に前年金額が変更されています。最新のフォーマットを出力し直してください。");
      if (amountToYen(before) !== amountToYen(after)) patches.push({ ...pair, accountId: accountId as number, month, before, after });
    });
  }
  if (!sheets.size || wb.worksheets.some(s => s.name !== metaName && !sheets.has(s.name))) fail("前年入力フォーマットのシート構成が正しくありません。");
  for (const [name, value] of sheets) {
    if (value.count !== contents.accounts.length || wb.getWorksheet(name)!.rowCount !== value.count + 3 || wb.getWorksheet(name)!.columnCount !== 14) fail("フォーマットの行・列を追加または削除しないでください。");
  }
  return patches;
}

export async function serializeWorkbook(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  return serializeWithFormulaSupport(wb);
}
export async function parsePreviousWorkbook(bytes: Uint8Array, contents: PlanContents): Promise<PreviousPatch[]> {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("取り込みファイルは20MB以下にしてください。");
  const wb = workbook();
  try { await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer); } catch { throw new Error("Excelファイルを読み込めません。前年入力フォーマットを選択してください。"); }
  return readPreviousWorkbook(wb, contents);
}
