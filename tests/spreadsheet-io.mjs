import assert from "node:assert/strict";
import ExcelJS from "exceljs";

// Evaluate the exported, trusted subset of Excel formulas independently of cached results.
function evaluator(wb) {
  const cache = new Map(), visiting = new Set();
  const value = (sheet, address) => {
    const key = `${sheet.name}:${address}`;
    if (cache.has(key)) return cache.get(key);
    assert.ok(!visiting.has(key), `循環参照: ${key}`); visiting.add(key);
    const cell = sheet.getCell(address);
    let result = cell.value ?? 0;
    if (cell.formula) {
      let expr = cell.formula.replace(/(?:'([^']+)'!)?\b([A-Z]+\d+)\b/g, (_, name, ref) => `(${JSON.stringify(value(name ? wb.getWorksheet(name) : sheet, ref))})`);
      expr = expr.replace(/(?<![<>=!])=(?!=)/g, "===");
      result = Function("SUM", "IF", "OR", `return (${expr})`)((...n) => n.reduce((a, b) => a + Number(b), 0), (condition, yes, no) => condition ? yes : no, (...conditions) => conditions.some(Boolean));
    }
    visiting.delete(key); cache.set(key, result); return result;
  };
  return value;
}
async function roundtrip(wb) {
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer()); return loaded;
}
export async function verifySpreadsheetIO(api) {
  const bytes = await api.createSamplePlan(2026), plan = await api.readPlanContents(bytes);
  const tables = ["cost-table", "expansion-table", "initiative-list"];
  for (let mask = 1; mask < 8; mask++) {
    const chosen = tables.filter((_, i) => mask & (1 << i));
    const wb = await roundtrip(api.createReportWorkbook(plan, { tables: chosen, selections: { "cost-table": [2, 1], "expansion-table": [2, 1], "initiative-list": [2] }, costFilter: { industries: null, departments: null } }));
    assert.deepEqual(wb.worksheets.map(s => s.name), [...["総原価表", "施策一覧", "展開表"].filter(n => wb.getWorksheet(n)), "計算元"]);
    assert.equal(wb.worksheets.length, chosen.length + 1);
    const evaluate = evaluator(wb);
    for (const sheet of wb.worksheets) sheet.eachRow(row => row.eachCell(cell => {
      if (!cell.formula) return;
      const actual = evaluate(sheet, cell.address), expected = cell.result;
      if (typeof expected === "number") assert.ok(Math.abs(actual - expected) < 1e-7, `${sheet.name}!${cell.address}: ${actual} != ${expected}`);
      else assert.equal(actual, expected);
    }));
    if (wb.getWorksheet("展開表")) {
      const expansion = wb.getWorksheet("展開表");
      assert.equal(expansion.getCell("G7").result, 20, "比較の向きは確定−一次");
      assert.ok(expansion.getCell("A3").isMerged);
      assert.equal(expansion.views[0].xSplit, 2);
    }
  }
  for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const wb = api.createReportWorkbook(plan, { tables: ["cost-table"], selections: { "cost-table": selected, "expansion-table": [1], "initiative-list": [1] }, costFilter: { industries: [plan.industries[0].id], departments: [plan.departments[0].id] } });
    const evaluate = evaluator(wb);
    const source = wb.getWorksheet("計算元");
    source.eachRow((row, i) => {
      if (i === 1) return;
      assert.equal(row.getCell(2).value, plan.industries[0].industryName, "絞り込み外の業種を計算元へ出力しない");
      assert.equal(row.getCell(3).value, plan.departments[0].departmentName, "絞り込み外の部署を計算元へ出力しない");
    });
    wb.getWorksheet("総原価表").eachRow(row => row.eachCell(cell => { if (cell.formula) { const result = evaluate(wb.getWorksheet("総原価表"), cell.address); assert.ok(typeof result !== "number" || Number.isFinite(result)); if (typeof cell.result === "number") assert.ok(Math.abs(result - cell.result) < 1e-7); } }));
  }
  // Editing an exported source must propagate into the annual total and rate formulas.
  const wb = api.createReportWorkbook(plan, { tables, selections: { "cost-table": [1, 2], "expansion-table": [1, 2], "initiative-list": [1] }, costFilter: { industries: null, departments: null } });
  const source = wb.getWorksheet("計算元"), expansion = wb.getWorksheet("展開表"), cost = wb.getWorksheet("総原価表");
  const original = evaluator(wb)(expansion, "C7"); source.getCell("I2").value += 10;
  assert.equal(evaluator(wb)(expansion, "C7"), original + 10);
  const sales = plan.accounts.find(a => a.id === plan.previousAmounts[0].accountId);
  const costRow = api.buildPeriodCostComparison(plan, [1, 2]).rows.findIndex(r => r.kind === "account" && r.id === sales.id) + 5;
  assert.equal(evaluator(wb)(cost, `B${costRow}`), Number(cost.getCell(`B${costRow}`).result) + 10);
  const pairs = [{ industryId: plan.industries[0].id, departmentId: plan.departments[0].id }, { industryId: plan.industries[1].id, departmentId: plan.departments[1].id }];
  const template = await roundtrip(api.createPreviousWorkbook(plan, pairs));
  assert.equal(template.worksheets.length, 3);
  assert.equal(template.getWorksheet("_triadichrome").state, "veryHidden");
  assert.deepEqual(api.readPreviousWorkbook(template, plan), []);
  const first = template.worksheets[0];
  const originalAmount = first.getCell("C4").value;
  first.getCell("C4").value = null; first.getCell("D4").value = 0; first.getCell("E4").value = -123.456;
  const patches = api.readPreviousWorkbook(template, plan);
  assert.equal(patches.length, 2); assert.ok(!patches.some(p => p.month === 4));
  assert.ok(patches.some(p => p.month === 5 && p.after === "0"));
  assert.ok(patches.some(p => p.month === 6 && p.after === "-123.456"));
  assert.deepEqual(await api.parsePreviousWorkbook(await api.serializeWorkbook(template), plan), patches);
  const updated = await api.changePlanSettings(bytes, { type: "previous-import", patches });
  const saved = await api.readPlanContents(updated);
  assert.equal(saved.previousAmounts.find(p => p.industryId === pairs[0].industryId && p.departmentId === pairs[0].departmentId && p.accountId === plan.accounts[0].id && p.month === 4).amount, String(originalAmount));
  assert.equal(saved.previousAmounts.find(p => p.industryId === pairs[0].industryId && p.departmentId === pairs[0].departmentId && p.accountId === plan.accounts[0].id && p.month === 6).amount, "-123.456");
  await assert.rejects(api.changePlanSettings(bytes, { type: "previous-import", patches: [...patches, { ...patches[0], accountId: -1 }] }), /マスタ/);
  assert.deepEqual(await api.readPlanContents(bytes), plan, "一部の失敗で元のデータを書き換えない");
  await assert.rejects(api.changePlanSettings(updated, { type: "previous-import", patches }), /変更/);
  for (const bad of [0.0001, "abc", { formula: "1+1", result: 2 }, { error: "#VALUE!" }]) {
    first.getCell("E4").value = bad; assert.throws(() => api.readPreviousWorkbook(template, plan));
  }
  first.getCell("E4").value = -123.456;
  assert.throws(() => api.readPreviousWorkbook(template, { ...plan, fiscalYear: 2027 }), /年度/);
  first.getCell("A4").value = "changed"; assert.throws(() => api.readPreviousWorkbook(template, plan), /科目/);
  assert.throws(() => api.createPreviousWorkbook(plan, [pairs[0], pairs[0]]));
  await assert.rejects(api.parsePreviousWorkbook(new Uint8Array([1, 2, 3]), plan), /読み込めません/);
  console.log("spreadsheet io ok: all selections, formulas, styles, precision, import and atomic failure");
}
