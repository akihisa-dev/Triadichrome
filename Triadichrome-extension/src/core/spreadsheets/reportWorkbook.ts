import ExcelJS from "exceljs";
import { initiativeMonths } from "../domain/calendar";
import type { KindId, KindSelections } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";
import { buildPeriodCostComparison, tablePeriods, expansionPeriodAmount } from "../tables/periodTables";
import { buildKindExpansionTable, filterPlan, type ClassificationFilter } from "../tables/planTables";
import { initiativesForKind } from "../tables/initiatives";
import { calculatedColumns, spillColumn, defineFormula, registerCalculation } from "./xlsxFormulaSupport";

export type ExportTable = "cost-table" | "expansion-table" | "initiative-list";
export type ExportOptions = { tables: ExportTable[]; selections: KindSelections; costFilter: ClassificationFilter };
const amountFormat = '[>=0.5]#,##0;[<=-0.5]-#,##0;""';
const inputFormat = '#,##0.###;-#,##0.###;0';
const font = { name: "Yu Gothic", size: 10, color: { argb: "FF202020" } };
const gray = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF3F3F3" } };
const line = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
type Value = string | number | null;
const validate = (ws: ExcelJS.Worksheet, range: string, rule: ExcelJS.DataValidation) =>
  (ws as ExcelJS.Worksheet & { dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void } }).dataValidations.add(range.replace("1048576", String(Math.max(4, ws.rowCount))), rule);
const thousand = (yen: number | null | undefined): Value => yen == null ? "" : yen / 1000;
const names = {
  accounts: "TC_Accounts", groups: "TC_Groups", members: "TC_Members", expansions: "TC_Expansions",
  industries: "TC_Industries", departments: "TC_Departments", periods: "TC_Periods",
  initiatives: "TC_Initiatives", amounts: "TC_Amounts", previous: "TC_Previous", order: "TC_CostOrder",
} as const;

function table(wb: ExcelJS.Workbook, title: string, name: string, columns: string[], rows: Value[][], note: string) {
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
  ws.getCell("A1").value = title; ws.getCell("A1").font = { ...font, size: 14, bold: true };
  ws.getCell("A2").value = note;
  // A blank input row keeps a table usable even when the plan has no records.
  ws.addTable({ name, ref: "A3", headerRow: true, totalsRow: false,
    columns: columns.map(name => ({ name, filterButton: true })),
    rows: rows.length ? rows : [columns.map(() => null)],
    style: { theme: "TableStyleLight1", showRowStripes: false } });
  columns.forEach((name, index) => {
    const col = ws.getColumn(index + 1); col.width = name.includes("月") ? 14 : name.endsWith("ID") ? 12 : 22;
    col.font = font;
    if (name.includes("月") && !name.includes("開始")) col.numFmt = inputFormat;
  });
  ws.getRow(3).height = 25;
  ws.getRow(3).font = { ...font, bold: true };
  ws.eachRow((row, index) => { if (index >= 4) row.height = 22; });
  if (columns[0]?.endsWith("ID") && ![names.amounts, names.previous, names.members].some(table => table === name)) {
    const ids = `${name}_IDs`; defineFormula(wb, ids, `${name}[${columns[0]}]`);
    validate(ws, "A4:A1048576", { type: "custom", allowBlank: false,
      formulae: [`AND(ISNUMBER(A4),A4=INT(A4),A4>0,COUNTIF(${ids},A4)=1)`],
      showErrorMessage: true, errorStyle: "stop", error: "既存と重複しない正の整数をIDに指定してください。" });
  }
  return ws;
}

function list(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, column: number, source: string, optional = false) {
  const name = `${ws.name.replace(/[^A-Za-z0-9\u3040-\u9fff]/g, "")}_${column}_候補`;
  defineFormula(wb, name, source);
  // Apply to existing Table rows; Excel copies validation when inserting Table rows.
  // Full-column validation would make ExcelJS readers expand millions of objects.
  validate(ws, `${ws.getColumn(column).letter}4:${ws.getColumn(column).letter}1048576`, {
    type: "list", allowBlank: optional, formulae: [name], showErrorMessage: true, errorStyle: "stop",
    errorTitle: "マスタにある値を選択してください", error: "候補を追加する場合は、先にマスタのテーブルへ追加してください。",
  });
}

function inputs(wb: ExcelJS.Workbook, plan: PlanContents, options: ExportOptions) {
  const accounts = table(wb, "科目マスタ", names.accounts, ["科目ID", "科目コード", "科目名", "科目属性"],
    plan.accounts.map(a => [a.id, a.accountCode, a.accountName, a.accountType]), "科目IDは重複しない番号です。参照中のIDは変更せず、科目コード・科目名・属性を編集します。");
  accounts.getColumn(2).numFmt = "@";
  validate(accounts, "D4:D1048576", { type: "list", allowBlank: true, formulae: ['"sales,cost,expense,profit"'], showErrorMessage: true, errorStyle: "stop", error: "sales＝売上、cost＝売上原価、expense＝費用、profit＝利益" });
  table(wb, "集計マスタ", names.groups, ["集計ID", "集計名", "表示名", "必須区分"],
    plan.aggregations.map(g => [g.id, g.name, g.displayName ?? g.name, g.required ?? ""]), "必須区分のsales・expenses・operating・ordinaryは各1件を維持します。所属と加減算は「集計対象」で編集します。");
  const members = table(wb, "集計対象", names.members, ["集計ID", "対象種別", "対象ID", "符号", "項目"],
    plan.aggregations.flatMap(g => g.members.map(m => [g.id, m.kind === "account" ? "科目" : "集計", m.id, m.sign, ""])),
    "符号は加算1・減算-1。同じ科目・集計の所属先は一つです。集計を自分自身や子の集計へ所属させないでください。");
  calculatedColumns(wb, members, names.members, { 項目: 'IF([@[対象ID]]="","",IF([@[対象種別]]="科目","a","g")&[@[対象ID]])' });
  list(wb, members, 1, `${names.groups}[集計ID]`);
  validate(members, "B4:B1048576", { type: "list", formulae: ['"科目,集計"'] });
  validate(members, "D4:D1048576", { type: "list", formulae: ['"1,-1"'] });
  members.getColumn(5).hidden = true;
  const expansions = table(wb, "展開マスタ", names.expansions, ["展開ID", "展開コード", "展開名"],
    plan.expansions.map(e => [e.id, e.expansionCode, e.expansionName]), "IDは参照を維持する番号です。名称を変更しても施策の対応を維持します。");
  expansions.getColumn(2).numFmt = "@";
  const industries = table(wb, "業種マスタ", names.industries, ["業種ID", "業種コード", "業種名", "総原価対象"],
    plan.industries.map(i => [i.id, i.industryCode, i.industryName, options.costFilter.industries === null || options.costFilter.industries.includes(i.id) ? 1 : 0]),
    "総原価対象は表示する業種を1、除外する業種を0。展開表・施策一覧には全業種を表示します。");
  industries.getColumn(2).numFmt = "@";
  const departments = table(wb, "部署マスタ", names.departments, ["部署ID", "部署名", "総原価対象"],
    plan.departments.map(d => [d.id, d.departmentName, options.costFilter.departments === null || options.costFilter.departments.includes(d.id) ? 1 : 0]),
    "総原価対象は表示する部署を1、除外する部署を0。新しい業種・部署も対象にする場合は1を入力します。");
  for (const [ws, col] of [[industries, 4], [departments, 3]] as const) validate(ws, `${ws.getColumn(col).letter}4:${ws.getColumn(col).letter}1048576`, { type: "list", formulae: ['"0,1"'] });
  table(wb, "期間マスタ", names.periods, ["期間ID", "期間名", "開始年月規則"],
    plan.periodTypes.map(p => [p.id, p.periodName, p.startMonthRule ?? ""]), "開始年月規則はnew＝新規、period_gap＝期間差、空欄＝自動判定なし。名称を変えても規則を維持します。");
  const initiatives = table(wb, "施策入力", names.initiatives,
    ["施策ID", "施策名", "備考", "展開ID", "業種ID", "部署ID", "期間ID", "展開名", "業種名", "部署名", "期間名"],
    plan.initiatives.filter(i => i.fiscalYear === plan.fiscalYear).map(i => [i.id, i.name, i.note, i.expansionId, i.industryId ?? null, i.departmentId ?? null, i.periodTypeId ?? null, "", "", "", ""]),
    "新しい施策は重複しない施策IDで末尾へ追加し、「施策金額」に同じIDの科目行を追加します。名称と分類はここで一度だけ入力します。");
  calculatedColumns(wb, initiatives, names.initiatives, Object.fromEntries([
    ["展開", names.expansions], ["業種", names.industries], ["部署", names.departments], ["期間", names.periods],
  ].map(([label, source]) => [`${label}名`, `IF([@[施策ID]]="","",IF([@[${label}ID]]="","",XLOOKUP([@[${label}ID]],${source}[${label}ID],${source}[${label}名])))`])));
  for (const [col, source, label] of [[4, names.expansions, "展開"], [5, names.industries, "業種"], [6, names.departments, "部署"], [7, names.periods, "期間"]] as const)
    list(wb, initiatives, col, `${source}[${label}ID]`, col === 7);
  const months = initiativeMonths.map(m => `${m}月`);
  const monetaryColumns = ["一次", "修正", "確定"].flatMap(prefix => months.map(m => prefix + m));
  const amounts = table(wb, "施策金額", names.amounts,
    ["施策ID", "科目ID", ...monetaryColumns, "施策名", "科目名", "科目属性", "展開ID", "業種ID", "部署ID", "売上係数", "費用係数", "利益係数", "総原価対象"],
    plan.initiatives.filter(i => i.fiscalYear === plan.fiscalYear).flatMap(i => i.rows.map(r => [i.id, r.accountId,
      ...initiativeMonths.map(m => Number(r.amounts[m] ?? 0)), ...initiativeMonths.map(m => r.overrides?.[2]?.[m] === undefined ? null : Number(r.overrides[2]![m])),
      ...months.map(() => ""), ...Array<Value>(10).fill("")])),
    "金額は千円・小数点以下3桁。一次は入力値、修正は確定予算の手修正です。修正の空欄は引き継ぎ、0は0への固定。確定と灰色の列は数式です。");
  const lookup = (label: string) => `IF([@[施策ID]]="","",XLOOKUP([@[施策ID]],${names.initiatives}[施策ID],${names.initiatives}[${label}]))`;
  const amountCalculations = {
    ...Object.fromEntries(months.map(m => [`確定${m}`, `IF([@[施策ID]]="","",IF([@[修正${m}]]="",[@[一次${m}]],[@[修正${m}]]))`])),
    施策名: lookup("施策名"), 科目名: `IF([@[科目ID]]="","",XLOOKUP([@[科目ID]],${names.accounts}[科目ID],${names.accounts}[科目名]))`,
    科目属性: `IF([@[科目ID]]="","",XLOOKUP([@[科目ID]],${names.accounts}[科目ID],${names.accounts}[科目属性])&"")`,
    展開ID: lookup("展開ID"), 業種ID: lookup("業種ID"), 部署ID: lookup("部署ID"),
    売上係数: 'IF([@[科目属性]]="sales",1,IF([@[科目属性]]="cost",-1,0))',
    費用係数: 'IF([@[科目属性]]="expense",1,0)',
    利益係数: 'IF(OR([@[科目属性]]="sales",[@[科目属性]]="profit"),1,IF(OR([@[科目属性]]="cost",[@[科目属性]]="expense"),-1,0))',
    総原価対象: `IF([@[施策ID]]="",0,IF(OR([@[業種ID]]=0,[@[部署ID]]=0),0,XLOOKUP([@[業種ID]],${names.industries}[業種ID],${names.industries}[総原価対象])*XLOOKUP([@[部署ID]],${names.departments}[部署ID],${names.departments}[総原価対象])))`,
  };
  calculatedColumns(wb, amounts, names.amounts, amountCalculations);
  list(wb, amounts, 1, `${names.initiatives}[施策ID]`); list(wb, amounts, 2, `${names.accounts}[科目ID]`);
  for (let col = 3; col <= 26; col++) validate(amounts, `${amounts.getColumn(col).letter}4:${amounts.getColumn(col).letter}1048576`, {
    type: "custom", allowBlank: true, formulae: [`AND(ISNUMBER(${amounts.getColumn(col).letter}4),ABS(${amounts.getColumn(col).letter}4*1000-ROUND(${amounts.getColumn(col).letter}4*1000,0))<0.000001)`],
    showErrorMessage: true, errorStyle: "stop", error: "千円単位・小数点以下3桁までの数値を入力してください。",
  });
  for (let col = 41; col <= 48; col++) amounts.getColumn(col).hidden = true;
  const classified = new Map<string, Map<number, string>>();
  for (const p of plan.previousAmounts) {
    const key = `${p.industryId}:${p.departmentId}:${p.accountId}`;
    if (!classified.has(key)) classified.set(key, new Map());
    classified.get(key)!.set(p.month, p.amount);
  }
  const previous = table(wb, "前年金額", names.previous,
    ["業種ID", "部署ID", "科目ID", ...months, "業種名", "部署名", "科目名", "科目属性", "売上係数", "利益係数", "総原価対象"],
    [...classified].map(([key, values]) => [...key.split(":").map(Number), ...initiativeMonths.map(m => Number(values.get(m) ?? 0)), ...Array<Value>(7).fill("")]),
    "前年の実額です。業種・部署・科目の組み合わせは各1行。末尾へ新しい組み合わせを追加できます。三表用のファイルはアプリへの取り込み対象ではありません。");
  calculatedColumns(wb, previous, names.previous, {
    ...Object.fromEntries([["業種", names.industries], ["部署", names.departments], ["科目", names.accounts]].map(([label, source]) =>
      [`${label}名`, `IF([@[科目ID]]="","",XLOOKUP([@[${label}ID]],${source}[${label}ID],${source}[${label}名]))`])),
    科目属性: `IF([@[科目ID]]="","",XLOOKUP([@[科目ID]],${names.accounts}[科目ID],${names.accounts}[科目属性])&"")`,
    売上係数: amountCalculations.売上係数, 利益係数: amountCalculations.利益係数,
    総原価対象: `IF([@[科目ID]]="",0,XLOOKUP([@[業種ID]],${names.industries}[業種ID],${names.industries}[総原価対象])*XLOOKUP([@[部署ID]],${names.departments}[部署ID],${names.departments}[総原価対象]))`,
  });
  for (const [col, source, label] of [[1, names.industries, "業種"], [2, names.departments, "部署"], [3, names.accounts, "科目"]] as const) list(wb, previous, col, `${source}[${label}ID]`);
  for (let col = 19; col <= 22; col++) previous.getColumn(col).hidden = true;
  const skeleton = buildPeriodCostComparison(plan, [1]);
  table(wb, "総原価行順", names.order, ["項目"], skeleton.rows.map(r => [r.kind === "ratio" ? "r" : `${r.kind === "account" ? "a" : "g"}${r.id}`]),
    "a＋科目ID、g＋集計ID、r＝利益率。行の移動で総原価表の並びを変更できます。追加した科目・集計は自動的に末尾へ表示されます。");
}

function formulas(wb: ExcelJS.Workbook, plan: PlanContents) {
  const a = names.amounts, p = names.previous, i = names.initiatives;
  defineFormula(wb, "TC_Year", String(plan.fiscalYear));
  defineFormula(wb, "TC_Months", `{${initiativeMonths.join(",")}}`);
  defineFormula(wb, "TC_KindName", 'LAMBDA(pKind,IF(pKind=0,"前年",IF(pKind=1,"一次予算","確定予算")))');
  defineFormula(wb, "TC_AmountColumn", `LAMBDA(pMonth,pKind,IF(pKind=1,INDEX(${a}[[一次4月]:[一次3月]],0,pMonth),INDEX(${a}[[確定4月]:[確定3月]],0,pMonth)))`);
  // SUMIFS uses Table columns and criteria, never enumerated source-cell addresses.
  defineFormula(wb, "TC_Account", `LAMBDA(pId,pMonth,pKind,IF(COUNTIF(${names.accounts}[科目ID],pId)<>1,NA(),
    SUMIFS(INDEX(${p}[[4月]:[3月]],0,pMonth),${p}[科目ID],pId,${p}[総原価対象],1)+
    IF(pKind=0,0,IF(pKind=1,
      SUMIFS(INDEX(${a}[[一次4月]:[一次3月]],0,pMonth),${a}[科目ID],pId,${a}[総原価対象],1),
      SUMIFS(INDEX(${a}[[確定4月]:[確定3月]],0,pMonth),${a}[科目ID],pId,${a}[総原価対象],1)))))`);
  defineFormula(wb, "TC_Group", `LAMBDA(pId,pMonth,pKind,pPath,IF(OR(COUNTIF(${names.groups}[集計ID],pId)<>1,ISNUMBER(SEARCH("|"&pId&"|",pPath))),NA(),
    LET(pChildren,FILTER(${names.members}[項目],${names.members}[集計ID]=pId,""),
      pSigns,FILTER(${names.members}[符号],${names.members}[集計ID]=pId,0),
      pValues,MAP(pChildren,LAMBDA(pKey,IF(pKey="","未設定",IF(COUNTIF(${names.members}[項目],pKey)<>1,NA(),TC_Value(pKey,pMonth,pKind,pPath&pId&"|"))))),
      IF(SUM(--ISERROR(pValues))>0,NA(),IF(COUNT(pValues)<>ROWS(pValues),"未設定",SUMPRODUCT(pSigns,pValues))))))`);
  defineFormula(wb, "TC_Value", `LAMBDA(pKey,pMonth,pKind,pPath,IF(pKey="","",IF(LEFT(pKey,1)="a",TC_Account(VALUE(MID(pKey,2,99)),pMonth,pKind),
    IF(LEFT(pKey,1)="g",TC_Group(VALUE(MID(pKey,2,99)),pMonth,pKind,pPath),
      LET(pSales,TC_Group(XLOOKUP("sales",${names.groups}[必須区分],${names.groups}[集計ID]),pMonth,pKind,"|"),
        pProfit,TC_Group(XLOOKUP("ordinary",${names.groups}[必須区分],${names.groups}[集計ID]),pMonth,pKind,"|"),
        IF(AND(ISNUMBER(pSales),ISNUMBER(pProfit)),IF(pSales=0,"",pProfit/pSales*100),"未設定"))))))`);
  defineFormula(wb, "TC_CostKeys", `LET(pAll,VSTACK("a"&FILTER(${names.accounts}[科目ID],${names.accounts}[科目ID]<>"",""),
    "g"&FILTER(${names.groups}[集計ID],${names.groups}[集計ID]<>"",""),"r"),
    pExisting,FILTER(${names.order}[項目],ISNUMBER(XMATCH(${names.order}[項目],pAll)),""),
    pAdded,FILTER(pAll,ISNA(XMATCH(pAll,${names.order}[項目])),""),pKeys,VSTACK(pExisting,pAdded),FILTER(pKeys,(pKeys<>"")*(pKeys<>"a")*(pKeys<>"g"),""))`);
  defineFormula(wb, "TC_CostName", `LAMBDA(pKey,IF(pKey="","",IF(LEFT(pKey,1)="a",XLOOKUP(VALUE(MID(pKey,2,99)),${names.accounts}[科目ID],${names.accounts}[科目名]),
    IF(LEFT(pKey,1)="g",XLOOKUP(VALUE(MID(pKey,2,99)),${names.groups}[集計ID],${names.groups}[表示名]),"利益率"))))`);
  defineFormula(wb, "TC_Period", `LAMBDA(pKey,pFirst,pCount,pKind,IF(pKey="r",
    LET(pSales,TC_Period("g"&XLOOKUP("sales",${names.groups}[必須区分],${names.groups}[集計ID]),pFirst,pCount,pKind),
      pProfit,TC_Period("g"&XLOOKUP("ordinary",${names.groups}[必須区分],${names.groups}[集計ID]),pFirst,pCount,pKind),
      IF(AND(ISNUMBER(pSales),ISNUMBER(pProfit)),IF(pSales=0,"",pProfit/pSales*100),"未設定")),
    IF(pCount=1,TC_Value(pKey,pFirst,pKind,"|"),LET(pMonthlyValues,MAP(SEQUENCE(pCount,1,pFirst),LAMBDA(pMonth,TC_Value(pKey,pMonth,pKind,"|"))),
      IF(SUM(--ISERROR(pMonthlyValues))>0,NA(),IF(COUNT(pMonthlyValues)=ROWS(pMonthlyValues),SUM(pMonthlyValues),"未設定"))))))`);
  defineFormula(wb, "TC_Difference", 'LAMBDA(pLeft,pRight,IF(AND(ISNUMBER(pLeft),ISNUMBER(pRight)),pLeft-pRight,IF(OR(pLeft="未設定",pRight="未設定"),"未設定","")))');
  defineFormula(wb, "TC_InitiativeKeys", `FILTER(${i}[施策ID],${i}[施策ID]<>"","")`);
  defineFormula(wb, "TC_Effect", `LAMBDA(pId,pMonth,pKind,pMetric,SUMPRODUCT(TC_AmountColumn(pMonth,pKind),
    IF(pMetric="sales",${a}[売上係数],IF(pMetric="expense",${a}[費用係数],${a}[利益係数])),--(${a}[施策ID]=pId)))`);
  defineFormula(wb, "TC_PreviousEffect", `LAMBDA(pMonth,pMetric,SUMPRODUCT(INDEX(${p}[[4月]:[3月]],0,pMonth),IF(pMetric="sales",${p}[売上係数],${p}[利益係数])))`);
  defineFormula(wb, "TC_TotalEffect", `LAMBDA(pMonth,pKind,pMetric,SUMPRODUCT(TC_AmountColumn(pMonth,pKind),IF(pMetric="sales",${a}[売上係数],${a}[利益係数])))`);
  defineFormula(wb, "TC_ExpansionEffect", `LAMBDA(pId,pMonth,pKind,pMetric,SUMPRODUCT(TC_AmountColumn(pMonth,pKind),IF(pMetric="sales",${a}[売上係数],${a}[利益係数]),--(${a}[展開ID]=pId)))`);
  defineFormula(wb, "TC_Start", `LAMBDA(pId,pKind,IF(pId="","",LET(pPeriod,XLOOKUP(pId,${i}[施策ID],${i}[期間ID]),
    pRule,XLOOKUP(pPeriod,${names.periods}[期間ID],${names.periods}[開始年月規則],""),
    pActive,MAP(SEQUENCE(12),LAMBDA(pMonth,SUMPRODUCT(--(${a}[施策ID]=pId),--(TC_AmountColumn(pMonth,pKind)<>0))>0)),
    pFirst,IFNA(XMATCH(TRUE,pActive),0),pLast,IFNA(XMATCH(TRUE,pActive,0,-1),0),
    pIndex,IF(pRule="new",pFirst,IF(AND(pRule="period_gap",pFirst=1,pLast<12,pLast>0),pLast+1,0)),
    IF(pIndex=0,"",LET(pCalendarMonth,INDEX(TC_Months,1,pIndex),pYear,TC_Year-IF(pRule="period_gap",1,0)+IF(pCalendarMonth<4,1,0),
      IF(pYear<1,"",TEXT(pYear,"0000")&"-"&TEXT(pCalendarMonth,"00")))))))`);
  defineFormula(wb, "TC_ExpansionKeys", `LET(pGroups,FILTER(${names.expansions}[展開ID],${names.expansions}[展開ID]<>"",""),
    pSorted,SORTBY(pGroups,LEN(XLOOKUP(pGroups,${names.expansions}[展開ID],${names.expansions}[展開コード],"")),1,
      XLOOKUP(pGroups,${names.expansions}[展開ID],${names.expansions}[展開コード],""),1),
    pKeys,REDUCE(VSTACK("previous","total","changes"),pSorted,LAMBDA(pRows,pId,IF(pId="",pRows,
      VSTACK(pRows,"i"&FILTER(${i}[施策ID],(${i}[展開ID]=pId)*(${i}[施策ID]<>""),""),"e"&pId)))),FILTER(pKeys,pKeys<>"i"))`);
  defineFormula(wb, "TC_ExpansionValue", `LAMBDA(pKey,pMonth,pKind,pMetric,IF(pKey="previous",TC_PreviousEffect(pMonth,pMetric),
    IF(pKey="changes",TC_TotalEffect(pMonth,pKind,pMetric),IF(pKey="total",TC_PreviousEffect(pMonth,pMetric)+TC_TotalEffect(pMonth,pKind,pMetric),
      IF(LEFT(pKey,1)="i",TC_Effect(VALUE(MID(pKey,2,99)),pMonth,pKind,pMetric),TC_ExpansionEffect(VALUE(MID(pKey,2,99)),pMonth,pKind,pMetric))))))`);
  defineFormula(wb, "TC_ExpansionPeriod", 'LAMBDA(pKey,pFirst,pCount,pKind,pMetric,SUM(MAP(SEQUENCE(pCount,1,pFirst),LAMBDA(pMonth,TC_ExpansionValue(pKey,pMonth,pKind,pMetric)))))');
}

function reportSheet(wb: ExcelJS.Workbook, title: string, widths: number[], headerEnd: number, frozen: number, year: number) {
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", xSplit: frozen, ySplit: headerEnd }] });
  ws.getCell("A1").value = title; ws.getCell("A1").font = { ...font, size: 14, bold: true };
  ws.getCell("A2").value = `${year}年度 · 単位：千円`;
  widths.forEach((width, index) => { const column = ws.getColumn(index + 1); column.width = width; column.font = font; column.numFmt = amountFormat; });
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${headerEnd}` };
  return ws;
}
function finish(ws: ExcelJS.Worksheet, headerEnd: number, start: number, periodWidth: number) {
  for (let row = 3; row <= ws.rowCount; row++) {
    ws.getRow(row).height = 22;
    for (let col = 1; col <= ws.columnCount; col++) {
      const cell = ws.getCell(row, col);
      cell.border = { top: line, bottom: line, left: line, right: line };
      cell.alignment = { vertical: "middle", horizontal: row <= headerEnd ? "center" : col < start ? "left" : "right" };
      if (row <= headerEnd) { cell.fill = gray; cell.font = { ...font, bold: true }; }
    }
  }
  // Column formatting and conditional formats continue into newly spilled rows.
  tablePeriods.forEach((p, index) => {
    if (p.months.length === 1) return;
    for (let offset = 0; offset < periodWidth; offset++) {
      const col = ws.getColumn(start + index * periodWidth + offset);
      col.fill = { ...gray, fgColor: { argb: p.months.length === 12 ? "FFC9C9C9" : p.months.length === 6 ? "FFDEDEDE" : "FFEBEBEB" } };
      if (p.months.length >= 6) col.font = { ...font, bold: true };
    }
  });
}
export function createReportWorkbook(plan: PlanContents, options: ExportOptions): ExcelJS.Workbook {
  if (!options.tables.length || new Set(options.tables).size !== options.tables.length || options.tables.some(t => !["cost-table", "expansion-table", "initiative-list"].includes(t))) throw new Error("出力する表を選択してください。");
  for (const [name, selected] of Object.entries(options.selections))
    if (!selected.length || selected.length > (name === "initiative-list" ? 1 : 2) || new Set(selected).size !== selected.length || selected.some(k => k !== 1 && k !== 2)) throw new Error("出力する種別が正しくありません。");
  const wb = new ExcelJS.Workbook(); wb.creator = "Triadichrome"; wb.calcProperties.fullCalcOnLoad = true;
  inputs(wb, plan, options); formulas(wb, plan);
  const reports: ExcelJS.Worksheet[] = [];
  if (options.tables.includes("cost-table")) {
    const selected = [...options.selections["cost-table"]].sort((a, b) => a - b);
    const output = buildPeriodCostComparison(filterPlan(plan, options.costFilter), selected);
    const width = output.labels.length;
    const ws = reportSheet(wb, "総原価表", [25, ...tablePeriods.flatMap(() => output.labels.map(() => 10))], 4, 1, plan.fiscalYear); reports.push(ws);
    ws.mergeCells("A3:A4"); ws.getCell("A3").value = "科目・集計";
    spillColumn(wb, ws, 5, 1, 'MAP(TC_CostKeys,LAMBDA(pKey,TC_CostName(pKey)))', output.rows.map(r => r.name));
    tablePeriods.forEach((period, pi) => {
      const start = 2 + pi * width;
      ws.mergeCells(3, start, 3, start + width - 1); ws.getCell(3, start).value = period.label;
      output.labels.forEach((label, vi) => {
        const col = start + vi; ws.getCell(4, col).value = label;
        const first = initiativeMonths.indexOf(period.months[0]!) + 1;
        const periodValue = (kind: number) => `TC_Period(pKey,${first},${period.months.length},${kind})`;
        const latest = selected[selected.length - 1]!;
        let expr = vi <= selected.length ? periodValue(vi === 0 ? 0 : selected[vi - 1]!) :
          `TC_Difference(${periodValue(latest)},${periodValue(vi === selected.length + 1 ? 0 : selected[0]!)} )`;
        expr = `MAP(TC_CostKeys,LAMBDA(pKey,${expr}))`;
        spillColumn(wb, ws, 5, col, expr, output.rows.map(r => r.kind === "ratio" ? r.configured ? r.values[vi]?.[period.id] ?? "" : "未設定" : r.configured ? thousand(r.values[vi]?.[period.id]) : "未設定"));
      });
    });
    finish(ws, 4, 2, width);
    const lastCol = ws.getColumn(ws.columnCount).letter;
    ws.addConditionalFormatting({ ref: `B5:${lastCol}1048576`, rules: [
      { type: "expression", priority: 2, formulae: ['INDEX(TC_CostKeys,ROW()-4)="r"'], style: { numFmt: '[>=0.05]0.0"%";[<=-0.05]-0.0"%";""' } },
      { type: "expression", priority: 3, formulae: ['LEFT(INDEX(TC_CostKeys,ROW()-4),1)<>"a"'], style: { font: { bold: true }, fill: gray } },
    ] });
    tablePeriods.forEach((_, pi) => {
      const firstDifference = ws.getColumn(2 + pi * width + selected.length + 1).letter;
      const lastDifference = ws.getColumn(2 + pi * width + width - 1).letter;
      ws.addConditionalFormatting({ ref: `${firstDifference}5:${lastDifference}1048576`, rules: [{ type: "expression", priority: 1, formulae: ['INDEX(TC_CostKeys,ROW()-4)="r"'], style: { numFmt: '[>=0.05]0.0"pt";[<=-0.05]-0.0"pt";""' } }] });
    });
  }
  if (options.tables.includes("initiative-list")) {
    const kind = options.selections["initiative-list"][0]!;
    const items = initiativesForKind(plan.initiatives, plan.accounts, kind).filter(i => i.fiscalYear === plan.fiscalYear);
    const ws = reportSheet(wb, "施策一覧", [34, 14, ...initiativeMonths.flatMap(() => [14, 14, 14])], 4, 2, plan.fiscalYear); reports.push(ws);
    ws.getCell("A2").value += ` · ${plan.kinds.find(k => k.id === kind)!.kindName}`;
    for (const [col, label] of [[1, "施策名"], [2, "開始年月"]] as const) { ws.mergeCells(3, col, 4, col); ws.getCell(3, col).value = label; }
    spillColumn(wb, ws, 5, 1, `MAP(TC_InitiativeKeys,LAMBDA(pId,IF(pId="","",XLOOKUP(pId,${names.initiatives}[施策ID],${names.initiatives}[施策名]))))`, items.map(i => i.name));
    spillColumn(wb, ws, 5, 2, `MAP(TC_InitiativeKeys,LAMBDA(pId,TC_Start(pId,${kind})))`, items.map(i => i.startYearMonths[kind] ?? ""));
    initiativeMonths.forEach((month, mi) => {
      ws.mergeCells(3, 3 + mi * 3, 3, 5 + mi * 3); ws.getCell(3, 3 + mi * 3).value = `${month}月`;
      (["sales", "expense", "profit"] as const).forEach((metric, offset) => {
        const col = 3 + mi * 3 + offset; ws.getCell(4, col).value = ["売上", "費用", "利益"][offset];
        ws.getColumn(col).numFmt = '#,##0;-#,##0;0';
        spillColumn(wb, ws, 5, col, `MAP(TC_InitiativeKeys,LAMBDA(pId,IF(pId="","",TC_Effect(pId,${mi + 1},${kind},"${metric}"))))`, items.map(i => thousand(i.months[month]?.[metric])));
      });
    });
    finish(ws, 4, 3, 0);
  }
  if (options.tables.includes("expansion-table")) {
    const selected = options.selections["expansion-table"];
    const output = buildKindExpansionTable(plan, selected, "registered");
    const labels = [...selected.map(k => plan.kinds.find(t => t.id === k)!.kindName), ...(selected.length === 2 ? ["比較"] : [])];
    const width = labels.length * 2;
    const ws = reportSheet(wb, "展開表", [17, 34, ...tablePeriods.flatMap(() => labels.flatMap(() => [14, 14]))], 5, 2, plan.fiscalYear); reports.push(ws);
    ws.mergeCells("A3:A5"); ws.mergeCells("B3:B5"); ws.getCell("A3").value = "展開名"; ws.getCell("B3").value = "施策名";
    const rows = [
      { key: "previous", name: "前年", expansion: "", values: output.previous },
      { key: "total", name: "合計", expansion: "", values: output.total },
      { key: "changes", name: "展開計", expansion: "", values: output.changes },
      ...output.groups.flatMap(g => [
        ...g.initiatives.map(item => ({ key: `i${item.id}`, name: item.name, expansion: g.expansion.expansionName, values: item.values })),
        { key: `e${g.expansion.id}`, name: `${g.expansion.expansionName}計`, expansion: g.expansion.expansionName, values: g.values },
      ]),
    ];
    spillColumn(wb, ws, 6, 1, `MAP(TC_ExpansionKeys,LAMBDA(pKey,IF(OR(pKey="previous",pKey="total",pKey="changes"),"",XLOOKUP(IF(LEFT(pKey,1)="i",XLOOKUP(VALUE(MID(pKey,2,99)),${names.initiatives}[施策ID],${names.initiatives}[展開ID]),VALUE(MID(pKey,2,99))),${names.expansions}[展開ID],${names.expansions}[展開名]))))`, rows.map(r => r.expansion));
    spillColumn(wb, ws, 6, 2, `MAP(TC_ExpansionKeys,LAMBDA(pKey,IF(pKey="previous","前年",IF(pKey="total","合計",IF(pKey="changes","展開計",IF(LEFT(pKey,1)="i",XLOOKUP(VALUE(MID(pKey,2,99)),${names.initiatives}[施策ID],${names.initiatives}[施策名]),XLOOKUP(VALUE(MID(pKey,2,99)),${names.expansions}[展開ID],${names.expansions}[展開名])&"計"))))))`, rows.map(r => r.name));
    tablePeriods.forEach((period, pi) => {
      const start = 3 + pi * width;
      ws.mergeCells(3, start, 3, start + width - 1); ws.getCell(3, start).value = period.label;
      labels.forEach((label, ki) => {
        ws.mergeCells(4, start + ki * 2, 4, start + ki * 2 + 1); ws.getCell(4, start + ki * 2).value = label;
        (["sales", "profit"] as const).forEach((metric, mi) => {
          const col = start + ki * 2 + mi; ws.getCell(5, col).value = metric === "sales" ? "売上" : "利益";
          const first = initiativeMonths.indexOf(period.months[0]!) + 1;
          const amount = (kind: KindId) => `TC_ExpansionPeriod(pKey,${first},${period.months.length},${kind},"${metric}")`;
          const expression = ki < selected.length ? amount(selected[ki]!) : `${amount(2)}-${amount(1)}`;
          spillColumn(wb, ws, 6, col, `MAP(TC_ExpansionKeys,LAMBDA(pKey,${expression}))`, rows.map(r => thousand(expansionPeriodAmount(r.values[ki]!, period, metric))));
        });
      });
    });
    finish(ws, 5, 3, width);
    ws.addConditionalFormatting({ ref: `A6:${ws.getColumn(ws.columnCount).letter}1048576`, rules: [{ type: "expression", priority: 1,
      formulae: ['LEFT(INDEX(TC_ExpansionKeys,ROW()-5),1)<>"i"'], style: { font: { bold: true }, fill: gray } }] });
  }
  const guide = wb.addWorksheet("使い方"); guide.getColumn(1).width = 115;
  ["Microsoft 365のExcelで運用", "金額は千円単位・小数点以下3桁まで。元データは計画全体を含みます。",
    "施策入力で名称・分類を設定し、施策金額で科目別・月別の増減を入力します。前年は前年金額で編集します。",
    "各入力表の末尾でTabを押すか、テーブルの行を挿入して追加します。IDは既存と重複しない正の整数を指定します。",
    "確定予算の修正欄：空欄は一次予算を引き継ぎ、数値は固定。0も固定値です。修正を消すと引き継ぎに戻ります。",
    "科目・分類・集計は各マスタで変更します。参照中のIDは変更せず、名称・コードを編集します。",
    "科目属性：sales＝売上、cost＝売上原価、expense＝費用、profit＝利益。開始年月規則：new＝新規、period_gap＝期間差。",
    "集計対象は対象種別・対象IDと符号を設定します。科目と集計の所属先は一つ。未設定の集計は「未設定」と表示します。",
    "業種・部署マスタの総原価対象を1／0で変更すると総原価表の範囲が変わります。展開表・施策一覧は全件です。",
    "三表は数式の結果です。行の追加・削除と名称変更が自動反映されるため、表の数値や表示先を直接編集しません。",
    "総原価行順で既存行を並べ替えます。新しい科目・集計は末尾へ自動表示され、項目を行順へ追加すると位置を指定できます。",
    "表の下に値を置くと自動展開を妨げます。#SPILL!では表示先を空け、#N/AではIDの参照先・集計の循環を確認してください。",
    "このファイルはExcel単体で運用するためのものです。アプリへ戻す場合は、別途出力する前年入力フォーマットだけを取り込めます。",
    "出力する表・比較列の数と種別は出力時の指定を維持します。マクロ・外部リンク・通信は使いません。",
  ].forEach((text, index) => { guide.getCell(index + 1, 1).value = text; guide.getRow(index + 1).height = index === 1 ? 24 : 32; });
  guide.getColumn(1).font = font; guide.getColumn(1).alignment = { wrapText: true, vertical: "middle" };
  guide.getCell("A1").font = { ...font, size: 14, bold: true };
  const ordered = [...reports, guide, ...wb.worksheets.filter(s => !reports.includes(s) && s !== guide)];
  ordered.forEach((ws, index) => { (ws as ExcelJS.Worksheet & { orderNo: number }).orderNo = index; });
  registerCalculation(wb);
  return wb;
}
