import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { formulaEvaluator } from "./excel-formula-evaluator.mjs";

const allTables = ["cost-table", "expansion-table", "initiative-list"];
const options = (tables = allTables, selected = [1, 2], filter = { industries: null, departments: null }) => ({ tables,
  selections: { "cost-table": selected, "expansion-table": selected, "initiative-list": [2] }, costFilter: filter });
const flatten = value => Array.isArray(value) ? value.flat(Infinity) : [value];
async function exported(api, plan, settings = options()) {
  const bytes = await api.serializeWorkbook(api.createReportWorkbook(plan, settings));
  // ExcelJS cannot parse calculatedColumnFormula children (4.4 parser bug).
  // Remove only those children from an inspection copy; validate originals below.
  const readable = await JSZip.loadAsync(bytes);
  for (const file of Object.values(readable.files).filter(f => /^xl\/tables\/table\d+\.xml$/.test(f.name)))
    readable.file(file.name, (await file.async("string")).replace(/<calculatedColumnFormula>[\s\S]*?<\/calculatedColumnFormula>/g, ""));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await readable.generateAsync({ type: "uint8array" }));
  return { wb, bytes, evaluate: await formulaEvaluator(wb, bytes) };
}
const close = (actual, expected, description) => typeof expected === "number" ?
  assert.ok(typeof actual === "number" && Math.abs(actual - expected) < 0.0000001, `${description}: ${actual} != ${expected}`) : assert.equal(actual ?? "", expected ?? "", description);
function cachedReports({ wb, evaluate }) {
  for (const sheet of wb.worksheets.filter(s => ["総原価表", "展開表", "施策一覧"].includes(s.name))) {
    sheet.eachRow(row => row.eachCell(cell => {
      if (!cell.formula) return;
      const values = flatten(evaluate.evaluate(sheet, cell.address));
      values.forEach((value, index) => {
        const cached = sheet.getCell(cell.row + index, cell.col);
        close(value, index === 0 ? cached.result : cached.value, `${sheet.name}!${cached.address}`);
      });
    }));
  }
}

export async function verifyReportWorkbooks(api, sample) {
  const sampleWorkbook = await exported(api, sample);
  cachedReports(sampleWorkbook);
  const zip = await JSZip.loadAsync(sampleWorkbook.bytes);
  assert.ok(zip.file("xl/metadata.xml"));
  const bookXml = await zip.file("xl/workbook.xml").async("string");
  assert.match(bookXml, /calcMode="auto"/);
  assert.match(bookXml, /TC_Account[^<]*[\s\S]*?SUMIFS/);
  assert.match(bookXml, /_xlfn.LAMBDA\(_xlpm.pId/);
  assert.doesNotMatch(bookXml, /<externalReferences/);
  // Names, prefixes, dynamic metadata, and calculation columns must survive the
  // actual serialization, including worksheets reordered to put reports first.
  for (const sheet of sampleWorkbook.wb.worksheets) {
    const xml = await zip.file(`xl/worksheets/sheet${sheet.id}.xml`).async("string");
    if (["総原価表", "展開表", "施策一覧"].includes(sheet.name)) {
      assert.match(xml, /cm="1"/);
      assert.match(xml, /<f t="array"/);
    } else assert.doesNotMatch(xml, /cm="1"/);
  }
  const amountTable = (await Promise.all(Object.values(zip.files).filter(f => /^xl\/tables\/table\d+\.xml$/.test(f.name)).map(f => f.async("string")))).find(x => x.includes('name="TC_Amounts"'));
  assert.match(amountTable, /calculatedColumnFormula>IF/);
  assert.match(amountTable, /修正4月/);
  assert.ok(!Object.keys(zip.files).some(name => /vbaProject|externalLinks/.test(name)));

  const plan = { ...sample,
    accounts: [
      { ...sample.accounts[0], id: 1, accountCode: "001", accountName: "売上", accountType: "sales" },
      { ...sample.accounts[0], id: 2, accountCode: "002", accountName: "原価", accountType: "cost" },
      { ...sample.accounts[0], id: 3, accountCode: "003", accountName: "費用", accountType: "expense" },
    ],
    aggregations: [
      { id: 1, name: "売上集計", required: "sales", members: [{ kind: "account", id: 1, sign: 1 }, { kind: "account", id: 2, sign: -1 }] },
      { id: 2, name: "費用集計", required: "expenses", members: [{ kind: "account", id: 3, sign: 1 }] },
      { id: 3, name: "営業利益", required: "operating", members: [{ kind: "group", id: 1, sign: 1 }, { kind: "group", id: 2, sign: -1 }] },
      { id: 4, name: "経常利益", required: "ordinary", members: [{ kind: "group", id: 3, sign: 1 }] },
      { id: 5, name: "未設定", required: null, members: [] },
    ],
    expansions: [{ id: 1, expansionCode: "01", expansionName: "拡販" }, { id: 2, expansionCode: "2", expansionName: "コスト" }],
    industries: [{ id: 1, industryCode: "01", industryName: "対象" }, { id: 2, industryCode: "02", industryName: "対象外" }],
    departments: [{ id: 1, departmentName: "部署A" }], periodTypes: [{ id: 1, periodName: "新規", startMonthRule: "new" }],
    previousAmounts: [100, 40, 20].map((amount, index) => ({ id: index + 1, accountId: index + 1, industryId: 1, departmentId: 1, month: 4, amount: String(amount), revision: 0 })),
    initiatives: [{ ...sample.initiatives[0], id: 10, name: "施策A", fiscalYear: sample.fiscalYear, expansionId: 1, industryId: 1, departmentId: 1, periodTypeId: 1,
      startYearMonths: { 1: "2026-04", 2: "2026-04" }, rows: [
        { accountId: 1, amounts: { 4: "10" }, overrides: { 2: { 4: "0" } } },
        { accountId: 1, amounts: { 4: "3" } }, { accountId: 2, amounts: { 4: "4" } }, { accountId: 3, amounts: { 4: "2" } },
      ] }, { ...sample.initiatives[0], id: 20, name: "施策B", fiscalYear: sample.fiscalYear, expansionId: 2, industryId: 2, departmentId: 1, periodTypeId: 1,
      startYearMonths: { 1: "2026-04", 2: "2026-04" }, rows: [{ accountId: 1, amounts: { 4: "50" } }] }],
  };
  for (let mask = 1; mask < 8; mask++) for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const tables = allTables.filter((_, index) => mask & (1 << index));
    const report = await exported(api, plan, options(tables, selected, { industries: [1], departments: [1] }));
    cachedReports(report);
    assert.deepEqual(report.wb.worksheets.slice(0, tables.length).map(s => s.name), ["総原価表", "施策一覧", "展開表"].filter(name => report.wb.getWorksheet(name)));
    // Even a single filtered report includes all raw plan data and both budgets.
    assert.equal(report.wb.getWorksheet("施策入力").rowCount, 5);
    assert.equal(report.wb.getWorksheet("施策金額").rowCount, 8);
    assert.equal(report.wb.getWorksheet("科目マスタ").getCell("B4").value, "001");
  }
  const report = await exported(api, plan, options(allTables, [1, 2], { industries: [1], departments: null }));
  const { wb, evaluate: calc } = report;
  const account = (...args) => calc.named("TC_Account")(...args), group = (...args) => calc.named("TC_Group")(...args);
  assert.equal(account(1, 1, 1), 113);
  assert.equal(account(1, 1, 2), 103);
  assert.equal(group(1, 1, 1, "|"), 69);
  assert.equal(group(4, 1, 2, "|"), 37);
  assert.equal(group(5, 1, 2, "|"), "未設定");
  wb.getWorksheet("施策金額").getCell("C4").value = 30; calc.reset();
  assert.equal(account(1, 1, 1), 133);
  assert.equal(account(1, 1, 2), 103, "修正0は一次予算の変更後も固定");
  wb.getWorksheet("施策金額").getCell("O4").value = null; calc.reset();
  assert.equal(account(1, 1, 2), 133, "修正の消去で一次予算へ再び追従");
  wb.getWorksheet("業種マスタ").getCell("D5").value = 1; calc.reset();
  assert.equal(account(1, 1, 2), 183, "分類の対象変更で全元データから再集計");
  wb.getWorksheet("施策入力").getCell("B4").value = "施策A改名";
  wb.getWorksheet("科目マスタ").getCell("C4").value = "売上改名";
  wb.getWorksheet("展開マスタ").getCell("C4").value = "展開改名"; calc.reset();
  assert.equal(flatten(calc.evaluate(wb.getWorksheet("施策一覧"), "A5"))[0], "施策A改名");
  assert.equal(flatten(calc.evaluate(wb.getWorksheet("総原価表"), "A5"))[0], "売上改名");
  assert.ok(flatten(calc.evaluate(wb.getWorksheet("展開表"), "A6")).includes("展開改名"));
  calc.append("TC_Initiatives", [30, "追加施策", "", 1, 1, 1, 1]);
  calc.append("TC_Amounts", [30, 1, 7, ...Array(23).fill(null)]);
  assert.equal(account(1, 1, 2), 190, "追加行の計算列と集計は増えたテーブルを参照");
  assert.deepEqual(flatten(calc.evaluate(wb.getWorksheet("施策一覧"), "A5")), ["施策A改名", "施策B", "追加施策"]);
  assert.ok(flatten(calc.evaluate(wb.getWorksheet("展開表"), "B6")).includes("追加施策"));
  calc.append("TC_Accounts", [4, "004", "追加費用", "expense"]);
  calc.append("TC_Members", [2, "科目", 4, 1]);
  calc.append("TC_Amounts", [30, 4, 2, ...Array(23).fill(null)]);
  assert.ok(flatten(calc.evaluate(wb.getWorksheet("総原価表"), "A5")).includes("追加費用"));
  assert.equal(group(4, 1, 2, "|"), 122, "新しい科目の所属を入れ子の経常利益へ反映");
  wb.getWorksheet("集計対象").getCell("D6").value = -1; calc.reset();
  assert.equal(group(4, 1, 2, "|"), 166, "符号の変更を入れ子の集計へ反映");
  // First/last nonzero month must be checked per input row, before cancellation.
  calc.append("TC_Initiatives", [40, "相殺", "", 1, 1, 1, 1]);
  calc.append("TC_Amounts", [40, 1, 9, ...Array(23).fill(null)]);
  calc.append("TC_Amounts", [40, 1, -9, ...Array(23).fill(null)]);
  assert.equal(calc.named("TC_Start")(40, 2), "2026-04");
  wb.getWorksheet("期間マスタ").getCell("B4").value = "改名した新規"; calc.reset();
  assert.equal(calc.named("TC_Start")(40, 2), "2026-04", "期間の改名後も規則を維持");
  calc.append("TC_Groups", [6, "追加集計", "追加集計", ""]);
  assert.ok(flatten(calc.evaluate(wb.getWorksheet("総原価表"), "A5")).includes("追加集計"));
  assert.equal(group(6, 1, 2, "|"), "未設定");
  calc.append("TC_Members", [6, "集計", 6, 1]);
  assert.throws(() => group(6, 1, 2, "|"), /#N\/A/, "循環を0で隠さずエラーにする");
  const gap = await exported(api, { ...plan, periodTypes: [{ id: 1, periodName: "改名した期間差", startMonthRule: "period_gap" }],
    initiatives: [{ ...plan.initiatives[0], startYearMonths: { 1: "2025-07", 2: "2025-07" }, rows: [{ accountId: 1, amounts: { 4: "1", 6: "1" } }] }] });
  assert.equal(gap.evaluate.named("TC_Start")(10, 1), "2025-07", "期間差の間の0月で途切れず、翌月を前年の開始月にする");
  gap.wb.getWorksheet("施策金額").getCell("N4").value = 1; gap.evaluate.reset();
  assert.equal(gap.evaluate.named("TC_Start")(10, 1), "", "3月まで続く期間差は未確定");
  const empty = { ...plan, initiatives: [], previousAmounts: [], expansions: [], industries: [], departments: [], periodTypes: [] };
  cachedReports(await exported(api, empty));
  assert.throws(() => api.createReportWorkbook(plan, options([])), /選択/);
  console.log("report workbook ok: source edits, overrides, added initiatives/accounts, master edits, filters, nested groups, spill metadata and cached reconciliation");
}
