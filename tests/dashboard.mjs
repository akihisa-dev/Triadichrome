import assert from "node:assert/strict";

export async function verifyDashboard(api) {
  const { createTriadicDatabase, readPlanContents, registerInitiative, buildDashboard, buildDashboardFlows, buildAccountTree, buildImpactTree, sumDashboardAmounts, buildCostTable } = api;
  let bytes = await createTriadicDatabase();
  const initial = await readPlanContents(bytes);
  const accounts = new Map(initial.accounts.map(item => [item.accountName, item.id]));
  const row = (name, amounts) => ({ accountId: accounts.get(name), amounts });
  const add = async (name, rows, year = 2026, departmentId = null) => {
    bytes = await registerInitiative(bytes, { name, note: "", fiscalYear: String(year), departmentId, expansionId: initial.expansions[0].id, rows });
  };
  await add("正負の入力", [row("売上高", { 4: "100", 5: "-20" }), row("本支店売上原価", { 4: "40" }), row("通信運搬費", { 4: "-10" }), row("営業外収益", { 4: "5" })]);
  await add("空欄", [row("売上高", {})]);
  await add("ゼロ", [row("売上高", { 4: "0" })]);
  await add("同一科目の小数", [row("売上高", { 4: "0.1" }), row("売上高", { 4: "0.2" })], 2026, initial.departments[0].id);
  await add("費用増加", [row("通信運搬費", { 4: "100" })]);
  await add("別年度", [row("売上高", { 4: "1000" })], 2025);
  const contents = await readPlanContents(bytes);
  const original = structuredClone(contents);
  const dashboard = buildDashboard(contents, 2026);
  assert.equal(dashboard.sales, 40.3);
  assert.equal(dashboard.profit, -44.7);
  assert.equal(dashboard.months[0].profit, -24.7);
  assert.equal(dashboard.months[1].profit, -20);
  assert.equal(dashboard.months[2].profit, 0);
  assert.equal(dashboard.impacts.find(item => item.initiative.name === "空欄").profit, 0);
  assert.equal(dashboard.impacts.find(item => item.initiative.name === "ゼロ").profit, 0);
  assert.equal(buildDashboard(contents, 2025).profit, 1000);
  assert.equal(buildDashboard(contents, 2027).profit, null);
  const increase = buildImpactTree(contents, dashboard.impacts, "profit", "increase", "department");
  assert.equal(increase.value, 55.3);
  assert.equal(increase.children.find(item => item.name === "未選択").value, 55);
  assert.equal(buildImpactTree(contents, dashboard.impacts, "profit", "decrease", "expansion").value, 100);
  assert.equal(buildImpactTree(contents, dashboard.impacts, "sales", "increase", "expansion").value, 40.3);
  const positiveFlows = buildDashboardFlows(contents, 2026, "increase");
  const negativeFlows = buildDashboardFlows(contents, 2026, "decrease");
  assert.equal(sumDashboardAmounts(positiveFlows.map(item => item.amount)), 245.3);
  assert.equal(sumDashboardAmounts(negativeFlows.map(item => item.amount)), -30);
  const sunPositive = buildAccountTree(contents, 2026, "increase");
  const sunNegative = buildAccountTree(contents, 2026, "decrease");
  assert.equal(sunPositive.value, 115.3);
  assert.equal(sunNegative.value, 160);
  assert.equal(sumDashboardAmounts([sunPositive.value, -sunNegative.value]), dashboard.profit, "集計の符号を反映した正負の内訳は集計の年間増減に一致する");
  const ordinary = buildCostTable(contents.accounts, contents.aggregations, contents.initiatives, 2026).find(item => item.name === "経常利益");
  assert.equal(sumDashboardAmounts(Object.values(ordinary.changes)), dashboard.profit);
  assert.deepEqual(contents, original, "表示用の処理で保存データを変更しない");
  assert.equal(sumDashboardAmounts([null, undefined]), null);
  assert.equal(sumDashboardAmounts([0, null]), 0);
  assert.equal(sumDashboardAmounts([0.1, 0.2]), 0.3);
  assert.throws(() => sumDashboardAmounts([Number.MAX_SAFE_INTEGER / 1000, 1]), /範囲/);
  const rectangles = api.partitionDashboardRects([{ key: "a", value: 60 }, { key: "b", value: 30 }, { key: "c", value: 10 }], 0, 0, 500, 300);
  for (const rect of rectangles) {
    assert.ok(Math.abs(rect.width * rect.height / 150000 - rect.node.value / 100) < 1e-10, "面積が金額の比率を保つ");
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 500.001 && rect.y + rect.height <= 300.001);
  }
  for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
    const a = rectangles[i], b = rectangles[j];
    assert.ok(a.x + a.width <= b.x + 1e-8 || b.x + b.width <= a.x + 1e-8 || a.y + a.height <= b.y + 1e-8 || b.y + b.height <= a.y + 1e-8, "内訳の面積を重ねない");
  }
  console.log("PASS: dashboard yearly totals, signed hierarchy, flows, null/zero, decimal precision and department grouping");
}
