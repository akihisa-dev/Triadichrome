import ExcelJS from "exceljs";
import { initiativeMonths } from "../domain/calendar";
import { amountToYen, yenToAmount } from "../domain/amounts";
import { resolvedAmount, type KindId, type KindSelections } from "../domain/kinds";
export type { PreviousPatch } from "../domain/kinds";
import type { PreviousPatch } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";
import { buildPeriodCostComparison, tablePeriods, expansionPeriodAmount } from "../tables/periodTables";
import { buildKindExpansionTable, filterPlan, type ClassificationFilter } from "../tables/planTables";
import { initiativesForKind } from "../tables/initiatives";
import { accountEffectsYen } from "../domain/accountEffects";

export type ExportTable = "cost-table" | "expansion-table" | "initiative-list";
export type ExportOptions = { tables: ExportTable[]; selections: KindSelections; costFilter: ClassificationFilter };
export type PreviousPair = { industryId: number; departmentId: number };
const amountFormat = '[>=0.5]#,##0;[<=-0.5]-#,##0;""';
const font = { name: "Yu Gothic", size: 10, color: { argb: "FF202020" } };
const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF3F3F3" } };
const border = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
const thousands = (yen: number | null | undefined) => yen == null ? yen : yen / 1000;
const cellRef = (sheet: ExcelJS.Worksheet, row: number, col: number) => `'${sheet.name.replaceAll("'", "''")}'!${sheet.getCell(row, col).address}`;
function formula(cell: ExcelJS.Cell, expression: string, result: number | string | undefined | null) {
  if (result === undefined) { cell.value = null; return; }
  cell.value = { formula: expression, result: result ?? "属性未設定" };
}
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
function periodStyles(ws: ExcelJS.Worksheet, start: number, width: number) {
  tablePeriods.forEach((period, index) => {
    if (period.months.length === 1) return;
    const color = period.months.length === 12 ? "FFC9C9C9" : period.months.length === 6 ? "FFDEDEDE" : "FFEBEBEB";
    for (let row = 3; row <= ws.rowCount; row++) for (let offset = 0; offset < width; offset++) {
      const cell = ws.getCell(row, start + index * width + offset);
      cell.fill = { ...fill, fgColor: { argb: color } };
      if (period.months.length >= 6) cell.font = { ...cell.font, bold: true };
      if (offset === 0) cell.border = { ...cell.border, left: { style: "medium", color: { argb: period.months.length === 12 ? "FF202020" : "FFA3A3A3" } } };
    }
  });
}
function workbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Triadichrome";
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** Editable original amounts, shared by formulas on independently selected output sheets. */
function sources(wb: ExcelJS.Workbook, contents: PlanContents, kinds: KindId[], includePrevious: boolean) {
  const ws = wb.addWorksheet("計算元");
  ws.addRow(["区分", "業種", "部署", "施策", "種別", "科目コード", "科目名", "科目属性", ...initiativeMonths.map(m => `${m}月`)]);
  const previous = new Map<number, number[]>();
  const previousSources: { industryId: number; departmentId: number; accountId: number; row: number }[] = [];
  const inputs = new Map<string, number[]>();
  const initiativeInputs = new Map<string, { row: number; attribute: string | null }[]>();
  const classified = new Map<string, typeof contents.previousAmounts>();
  for (const value of includePrevious ? contents.previousAmounts : []) {
    const key = `${value.industryId}:${value.departmentId}:${value.accountId}`;
    classified.set(key, [...classified.get(key) ?? [], value]);
  }
  for (const records of classified.values()) {
    const value = records[0]!;
    const row = ws.addRow(["前年", contents.industries.find(i => i.id === value.industryId)?.industryName,
      contents.departments.find(d => d.id === value.departmentId)?.departmentName, "", "前年",
      contents.accounts.find(a => a.id === value.accountId)?.accountCode, contents.accounts.find(a => a.id === value.accountId)?.accountName,
      contents.accounts.find(a => a.id === value.accountId)?.accountType,
      ...initiativeMonths.map(m => Number(records.find(v => v.month === m)?.amount ?? "0"))]).number;
    previous.set(value.accountId, [...previous.get(value.accountId) ?? [], row]);
    previousSources.push({ industryId: value.industryId, departmentId: value.departmentId, accountId: value.accountId, row });
  }
  for (const item of contents.initiatives.filter(i => i.fiscalYear === contents.fiscalYear)) {
    for (const kind of kinds) for (const input of item.rows) {
      const account = contents.accounts.find(a => a.id === input.accountId);
      const row = ws.addRow(["施策", contents.industries.find(i => i.id === item.industryId)?.industryName,
        contents.departments.find(d => d.id === item.departmentId)?.departmentName, item.name, contents.kinds.find(k => k.id === kind)?.kindName,
        account?.accountCode, account?.accountName, account?.accountType,
        ...initiativeMonths.map(m => Number(resolvedAmount(input, kind, m)))]).number;
      const key = `${input.accountId}:${kind}`;
      inputs.set(key, [...inputs.get(key) ?? [], row]);
      const ikey = `${item.id}:${kind}`;
      initiativeInputs.set(ikey, [...initiativeInputs.get(ikey) ?? [], { row, attribute: account?.accountType ?? null }]);
    }
  }
  ws.columns.forEach((column, index) => { column.width = index < 8 ? 20 : 14; if (index >= 8) column.numFmt = '#,##0.###'; });
  ws.views = [{ state: "frozen", xSplit: 8, ySplit: 1 }];
  ws.getRow(1).font = { ...font, bold: true }; ws.getRow(1).fill = fill;
  return { ws, previous, previousSources, inputs, initiativeInputs };
}
const sum = (refs: string[]) => refs.length ? `SUM(${refs.join(",")})` : "0";

export function createReportWorkbook(contents: PlanContents, options: ExportOptions): ExcelJS.Workbook {
  if (!options.tables.length || new Set(options.tables).size !== options.tables.length || options.tables.some(t => !["cost-table", "expansion-table", "initiative-list"].includes(t))) throw new Error("出力する表を選択してください。");
  for (const [name, selected] of Object.entries(options.selections)) {
    if (!selected.length || selected.length > (name === "initiative-list" ? 1 : 2) || new Set(selected).size !== selected.length || selected.some(k => k !== 1 && k !== 2)) throw new Error("出力する種別が正しくありません。");
  }
  const wb = workbook();
  // Source sheets are created last in tab order after all report sheets are populated.
  const filtered = filterPlan(contents, options.costFilter);
  const sourceContents = options.tables.every(t => t === "cost-table") ? filtered : contents;
  const sourceKinds = [...new Set(options.tables.flatMap(t => options.selections[t]))];
  const unfiltered = sources(wb, sourceContents, sourceKinds, options.tables.some(t => t !== "initiative-list"));
  // References use classified original rows; indexes retain a stable original-record order.
  const priorRows = new Map<number, number[]>();
  unfiltered.previousSources.forEach(p => {
    if ((options.costFilter.industries === null || options.costFilter.industries.includes(p.industryId)) && (options.costFilter.departments === null || options.costFilter.departments.includes(p.departmentId))) priorRows.set(p.accountId, [...priorRows.get(p.accountId) ?? [], p.row]);
  });
  const includedInitiatives = new Set(filtered.initiatives.map(i => i.id));
  const costInputRows = (accountId: number, kind: KindId) => contents.initiatives.filter(i => includedInitiatives.has(i.id)).flatMap(i => unfiltered.initiativeInputs.get(`${i.id}:${kind}`) ?? []).filter(r => unfiltered.inputs.get(`${accountId}:${kind}`)?.includes(r.row)).map(r => r.row);
  const inputRefs = (rowNumbers: number[], month: number) => rowNumbers.map(r => cellRef(unfiltered.ws, r, initiativeMonths.indexOf(month as typeof initiativeMonths[number]) + 9));
  if (options.tables.includes("cost-table")) {
    const selected = [...options.selections["cost-table"]].sort((a, b) => a - b);
    const table = buildPeriodCostComparison(filtered, selected);
    const ws = sheet(wb, "総原価表", [25, ...tablePeriods.flatMap(() => table.labels.map(() => 10))], 2, 1);
    ws.getCell("A2").value = `${contents.fiscalYear}年度 · 単位：千円`;
    ws.mergeCells("A3:A4"); ws.getCell("A3").value = "科目・集計";
    const width = table.labels.length;
    tablePeriods.forEach((p, index) => {
      const start = 2 + index * width;
      ws.mergeCells(3, start, 3, start + width - 1); ws.getCell(3, start).value = p.label;
      table.labels.forEach((label, i) => { ws.getCell(4, start + i).value = label; });
    });
    const rowMap = new Map(table.rows.map((r, i) => [`${r.kind}:${r.id}`, i + 5]));
    const sales = table.rows.find(r => r.kind === "group" && r.id === contents.aggregations.find(g => g.required === "sales")?.id)!;
    const profit = table.rows.find(r => r.kind === "group" && r.id === contents.aggregations.find(g => g.required === "ordinary")?.id)!;
    const shaded = new Set<number>();
    table.rows.forEach((row, index) => {
      const r = index + 5;
      ws.getCell(r, 1).value = row.name + (row.configured ? "" : "\n未設定");
      if (row.kind !== "account") shaded.add(r);
      tablePeriods.forEach((period, pi) => row.values.forEach((values, vi) => {
        const col = 2 + pi * width + vi;
        const cell = ws.getCell(r, col);
        const value = values[period.id];
        const at = (ri: number, valueIndex = vi) => ws.getCell(ri, 2 + pi * width + valueIndex).address;
        let expression = "0";
        if (vi > selected.length) expression = `${at(r, selected.length)}-${at(r, vi === selected.length + 1 ? 0 : 1)}`;
        else if (row.kind === "ratio") {
          const denominator = at(rowMap.get(`group:${sales.id}`)!);
          expression = `IF(${denominator}=0,"",${at(rowMap.get(`group:${profit.id}`)!)}/${denominator}*100)`;
        } else if (period.months.length > 1) expression = sum(period.months.map(m => ws.getCell(r, 2 + tablePeriods.findIndex(p => p.id === String(m)) * width + vi).address));
        else if (row.kind === "group") {
          const definition = contents.aggregations.find(g => g.id === row.id)!;
          expression = definition.members.map(m => `${m.sign === -1 ? "-" : "+"}${at(rowMap.get(`${m.kind}:${m.id}`)!)}`).join("").replace(/^\+/, "") || "0";
        } else {
          const prior = sum(inputRefs(priorRows.get(row.id) ?? [], period.months[0]!));
          expression = vi === 0 ? prior : `${prior}+${sum(inputRefs(costInputRows(row.id, selected[vi - 1]!), period.months[0]!))}`;
        }
        if (row.kind === "ratio" && vi > selected.length) expression = `IF(OR(${at(r, selected.length)}="",${at(r, vi === selected.length + 1 ? 0 : 1)}=""),"",${expression})`;
        formula(cell, expression, row.kind === "ratio" ? row.configured ? value ?? "" : value : thousands(value));
        if (row.kind === "ratio") cell.numFmt = vi > selected.length ? '[>=0.05]0.0"pt";[<=-0.05]-0.0"pt";""' : '[>=0.05]0.0"%";[<=-0.05]-0.0"%";""';
      }));
    });
    finish(ws, 4, shaded);
    periodStyles(ws, 2, width);
    const salesRow = rowMap.get(`group:${sales.id}`)!;
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: salesRow }];
  }
  const effectFormula = (itemId: number, kind: KindId, month: number, metric: "sales" | "expense" | "profit") => {
    const parts = (unfiltered.initiativeInputs.get(`${itemId}:${kind}`) ?? []).flatMap(input => {
      const sign = accountEffectsYen(1, input.attribute)[metric];
      return sign ? [`${sign < 0 ? "-" : "+"}${inputRefs([input.row], month)[0]}`] : [];
    });
    return parts.join("").replace(/^\+/, "") || "0";
  };
  if (options.tables.includes("initiative-list")) {
    const kind = options.selections["initiative-list"][0]!;
    const ws = sheet(wb, "施策一覧", [34, 14, ...initiativeMonths.flatMap(() => [14, 14, 14])], 2, 2);
    ws.getCell("A2").value = `${contents.fiscalYear}年度 · 単位：千円 · ${contents.kinds.find(k => k.id === kind)!.kindName}`;
    for (const [col, name] of [[1, "施策名"], [2, "開始年月"]] as const) { ws.mergeCells(3, col, 4, col); ws.getCell(3, col).value = name; }
    initiativeMonths.forEach((m, mi) => { ws.mergeCells(3, 3 + mi * 3, 3, 5 + mi * 3); ws.getCell(3, 3 + mi * 3).value = `${m}月`; ["売上", "費用", "利益"].forEach((s, i) => { ws.getCell(4, 3 + mi * 3 + i).value = s; }); });
    initiativesForKind(contents.initiatives, contents.accounts, kind).filter(i => i.fiscalYear === contents.fiscalYear).forEach((item, index) => {
      const r = index + 5;
      ws.getCell(r, 1).value = item.name; ws.getCell(r, 2).value = item.startYearMonths[kind];
      initiativeMonths.forEach((m, mi) => (["sales", "expense", "profit"] as const).forEach((metric, i) => {
        const cell = ws.getCell(r, 3 + mi * 3 + i);
        formula(cell, effectFormula(item.id, kind, m, metric), thousands(item.months[m]?.[metric])); cell.numFmt = '#,##0;-#,##0;0';
      }));
    });
    finish(ws, 4);
  }
  if (options.tables.includes("expansion-table")) {
    const selected = options.selections["expansion-table"];
    const table = buildKindExpansionTable(contents, selected, "registered");
    const labels = [...selected.map(k => contents.kinds.find(t => t.id === k)!.kindName), ...(selected.length === 2 ? ["比較"] : [])];
    const width = labels.length * 2;
    const ws = sheet(wb, "展開表", [17, 34, ...tablePeriods.flatMap(() => labels.flatMap(() => [14, 14]))], 3, 2);
    ws.getCell("A2").value = `${contents.fiscalYear}年度 · 単位：千円`;
    ws.mergeCells("A3:A5"); ws.mergeCells("B3:B5"); ws.getCell("A3").value = "展開名"; ws.getCell("B3").value = "施策名";
    tablePeriods.forEach((p, pi) => {
      const start = 3 + pi * width;
      ws.mergeCells(3, start, 3, start + width - 1); ws.getCell(3, start).value = p.label;
      labels.forEach((label, li) => { ws.mergeCells(4, start + li * 2, 4, start + li * 2 + 1); ws.getCell(4, start + li * 2).value = label; ws.getCell(5, start + li * 2).value = "売上"; ws.getCell(5, start + li * 2 + 1).value = "利益"; });
    });
    const shaded = new Set([7, 8]);
    const subtotals: number[] = [];
    let next = 9;
    const amountRow = (r: number, values: typeof table.total, monthly: (ki: number, metric: "sales" | "profit", month: number, col: number) => string) => {
      tablePeriods.forEach((p, pi) => values.forEach((value, ki) => (["sales", "profit"] as const).forEach((metric, mi) => {
        const col = 3 + pi * width + ki * 2 + mi;
        let expr: string;
        if (ki === selected.length) expr = `${ws.getCell(r, 3 + pi * width + selected.indexOf(2) * 2 + mi).address}-${ws.getCell(r, 3 + pi * width + selected.indexOf(1) * 2 + mi).address}`;
        else if (p.months.length > 1) expr = sum(p.months.map(m => ws.getCell(r, 3 + tablePeriods.findIndex(t => t.id === String(m)) * width + ki * 2 + mi).address));
        else expr = monthly(ki, metric, p.months[0]!, col);
        formula(ws.getCell(r, col), expr, thousands(expansionPeriodAmount(value, p, metric)));
      })));
    };
    for (const group of table.groups) {
      const start = next;
      const members: number[] = [];
      for (const item of group.initiatives) {
        const r = next++; members.push(r);
        ws.getCell(r, 2).value = item.name;
        amountRow(r, item.values, (ki, metric, m) => effectFormula(item.id, selected[ki]!, m, metric));
      }
      const r = next++; subtotals.push(r); shaded.add(r);
      ws.getCell(start, 1).value = group.expansion.expansionName;
      if (start < r) ws.mergeCells(start, 1, r, 1);
      ws.getCell(r, 2).value = `${group.expansion.expansionName}計`;
      amountRow(r, group.values, (_, __, ___, col) => sum(members.map(ri => ws.getCell(ri, col).address)));
    }
    ["前年", "合計", "展開計"].forEach((label, i) => { ws.mergeCells(6 + i, 1, 6 + i, 2); ws.getCell(6 + i, 1).value = label; });
    amountRow(6, table.previous, (_, metric, m) => contents.accounts.map(a => {
      const sign = accountEffectsYen(1, a.accountType)[metric];
      return sign ? `${sign < 0 ? "-" : "+"}${sum(inputRefs(unfiltered.previous.get(a.id) ?? [], m))}` : "";
    }).join("").replace(/^\+/, "") || "0");
    amountRow(8, table.changes, (_, __, ___, col) => sum(subtotals.map(ri => ws.getCell(ri, col).address)));
    amountRow(7, table.total, (_, __, ___, col) => `${ws.getCell(6, col).address}+${ws.getCell(8, col).address}`);
    finish(ws, 5, shaded);
    periodStyles(ws, 3, width);
  }
  // ExcelJS exposes orderNo for workbook tab ordering.
  (unfiltered.ws as ExcelJS.Worksheet & { orderNo: number }).orderNo = wb.worksheets.length;
  wb.worksheets.filter(s => s !== unfiltered.ws).forEach((s, i) => { (s as ExcelJS.Worksheet & { orderNo: number }).orderNo = i; });
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
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
export async function parsePreviousWorkbook(bytes: Uint8Array, contents: PlanContents): Promise<PreviousPatch[]> {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("取り込みファイルは20MB以下にしてください。");
  const wb = workbook();
  try { await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer); } catch { throw new Error("Excelファイルを読み込めません。前年入力フォーマットを選択してください。"); }
  return readPreviousWorkbook(wb, contents);
}
