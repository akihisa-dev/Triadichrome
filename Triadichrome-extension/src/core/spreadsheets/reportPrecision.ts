import type ExcelJS from "exceljs";
import { amountToYen } from "../domain/amounts";
export type MonetaryCell = { cell: ExcelJS.Cell; expression: string; yen: number | null };
const columnNumber = (name: string) => [...name].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
export function roundedThousands(yen: number): number {
  const value = BigInt(yen), absolute = value < 0n ? -value : value;
  return Number((value < 0n ? -1n : 1n) * ((absolute + 500n) / 1000n));
}

/** Three signed integer pieces keep each SUM within Excel's 15 significant digits,
 * even at the worksheet row limit. Monetary arithmetic never uses rounded cells. */
export function installPreciseCalculations(wb: ExcelJS.Workbook, money: MonetaryCell[]): void {
  const source = wb.getWorksheet("計算元")!;
  const sourceColumn = (column: number, component: number) => 25 + component * 12 + column - 9;
  // Share the text normalization once per source amount rather than repeating it
  // in each integer component (including copied source rows).
  for (let column = 9; column <= 20; column++) {
    const textColumn = column + 52;
    source.getColumn(textColumn).hidden = true;
    source.getCell(1, textColumn).value = `${source.getCell(1, column).text}：金額の文字列`;
    for (let row = 2; row <= source.rowCount; row++) {
      const input = source.getCell(row, column), address = input.address;
      const signedText = `${address}&""`;
      const text = source.getCell(row, textColumn);
      text.value = { formula: `IF(ISNUMBER(${address}),TEXT(ABS(${address}),"0.000"),IF(LEFT(${signedText},1)="-",MID(${address},2,LEN(${address})),IF(LEFT(${signedText},1)="+",MID(${address},2,LEN(${address})),${signedText})))`,
        result: typeof input.value === "number" ? Math.abs(input.value).toFixed(3) : String(input.value ?? "0").replace(/^[+-]/, "") };
      const point = `FIND(".",${text.address}&".")`;
      const integer = `VALUE("0"&LEFT(${text.address},${point}-1))`;
      const sign = `IF(LEFT(${signedText},1)="-",-1,1)`;
      const yen = BigInt(amountToYen(String(input.value ?? "0")));
      for (let component = 0; component < 3; component++) {
        const helper = sourceColumn(column, component);
        source.getColumn(helper).hidden = true;
        source.getCell(1, helper).value = `${source.getCell(1, column).text}：円整数の分割${component + 1}`;
        const expression = component === 0 ? `INT(${integer}/1000000)` : component === 1 ? `MOD(${integer},1000000)` : `VALUE(LEFT(MID(${text.address},${point}+1,3)&"000",3))`;
        const result = Number(component === 0 ? yen / 1000000000n : component === 1 ? yen / 1000n % 1000000n : yen % 1000n);
        source.getCell(row, helper).value = { formula: `${sign}*${expression}`, result };
      }
    }
    // Empty source sheets still expose and hide every calculation column.
    for (let component = 0; component < 3; component++) {
      const helper = sourceColumn(column, component);
      source.getColumn(helper).hidden = true;
      source.getCell(1, helper).value = `${source.getCell(1, column).text}：円整数の分割${component + 1}`;
    }
  }
  for (const ws of wb.worksheets.filter(sheet => sheet !== source)) {
    const width = ws.columnCount;
    const cells = money.filter(record => record.cell.worksheet === ws);
    const addresses = new Set(cells.map(record => record.cell.address));
    const ref = (cell: ExcelJS.Cell, component: number) => ws.getCell(Number(cell.row), Number(cell.col) + width * (component + 1)).address;
    const translate = (expression: string, component: number) => expression
      .replace(/'計算元'!\$([A-Z]+):\$([A-Z]+)/g, (match, first: string, last: string) => {
        const column = columnNumber(first);
        if (column < 9 || column > 20 || first !== last) return match;
        const helper = source.getColumn(sourceColumn(column, component)).letter;
        return `'計算元'!$${helper}:$${helper}`;
      })
      .replace(/(\$?)([A-Z]+)(\$?)(\d+)\b/g, (match, absoluteColumn: string, column: string, absoluteRow: string, row: string) =>
        addresses.has(`${column}${row}`) ? `${absoluteColumn}${ws.getColumn(columnNumber(column) + width * (component + 1)).letter}${absoluteRow}${row}` : match);
    const unrounded = (cell: ExcelJS.Cell) => {
      const [high, middle, low] = [0, 1, 2].map(component => ref(cell, component));
      return `(${high}*1000000+${middle}+INT(${low}/1000)+MOD(${low},1000)/1000)`;
    };
    // Ratios use original amounts; differences between ratios retain their original formulas.
    ws.eachRow(row => row.eachCell(cell => {
      if (!cell.formula || addresses.has(cell.address)) return;
      const expression = cell.formula.replace(/\b([A-Z]+\d+)\b/g, (match: string) => addresses.has(match) ? unrounded(ws.getCell(match)) : match);
      cell.value = { formula: expression, result: cell.result as number | string };
    }));
    for (let column = width + 1; column <= width * 4; column++) ws.getColumn(column).hidden = true;
    ws.pageSetup.printArea = `A1:${ws.getCell(ws.rowCount, width).address}`;
    for (const { cell, expression, yen } of cells) {
      for (let component = 0; component < 3; component++) {
        // Uncached intermediate formulas avoid publishing a differently normalized split.
        ws.getCell(ref(cell, component)).value = { formula: yen === null ? '"属性未設定"' : translate(expression, component) };
      }
      const [high, middle, low] = [0, 1, 2].map(component => ref(cell, component));
      const integer = `(${high}*1000000+${middle}+INT(${low}/1000))`;
      cell.value = { formula: yen === null ? '"属性未設定"' : `${integer}+INT((MOD(${low},1000)+IF(${integer}<0,499,500))/1000)`, result: yen === null ? "属性未設定" : roundedThousands(yen) };
    }
  }
}
