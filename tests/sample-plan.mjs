import assert from "node:assert/strict";

export async function verifySamplePlan(api) {
  const { createSamplePlan, validateTriadicDatabase, readPlanContents, buildCostTable, initiativeMonths, changeAccountMaster, changeAggregationMaster, openTriadicDatabase } = api;
  const bytes = await createSamplePlan(2026);
  await validateTriadicDatabase(bytes);
  const { accounts, initiatives, aggregations } = await readPlanContents(bytes);
  assert.equal(accounts.length, 16);
  assert.equal(aggregations.length, 11);
  assert.equal(initiatives.length, 13);
  assert.deepEqual(new Set(accounts.map(account => account.accountType)), new Set(["sales", "cost", "expense", "profit"]));
  assert.equal(accounts[0].accountCode, "001");
  assert.deepEqual([...new Set(initiatives.map(item => item.fiscalYear))].sort(), [2025, 2026, 2027]);
  const product = initiatives.find(item => item.name === "既存商品の販売拡大");
  assert.equal(product.rows[0].accountId, product.rows[1].accountId);
  assert.equal(product.rows[0].amounts[4], "120000");
  assert.equal(product.rows[0].amounts[3], "175000");
  assert.equal(product.months[4].sales, 90000);
  assert.equal(product.months[4].profit, 79125.5);
  const zero = initiatives.find(item => item.name === "ゼロと相殺の確認");
  assert.deepEqual(zero.months[4], { sales: 0, profit: 0 });
  assert.deepEqual(zero.months[5], { sales: 0, profit: 0 });
  assert.equal(zero.months[6], undefined);
  assert.equal(initiatives.find(item => item.name === "通信費と消耗品費の削減").months[4].profit, 3750.75);
  for (const year of [2025, 2026, 2027]) {
    const table = buildCostTable(accounts, aggregations, initiatives, year);
    assert.ok(table.every(item => Object.keys(item.previous).length === 0), "別年度の施策を前年合計値にしない");
    assert.ok(table.filter(item => item.required).every(item => item.configured), "必須4集計をすぐ確認できる");
    const ordinary = table.find(item => item.name === "経常利益");
    for (const month of initiativeMonths) {
      const expected = initiatives.filter(item => item.fiscalYear === year).reduce((total, item) => total + (item.months[month]?.profit ?? 0), 0);
      assert.equal(ordinary.budget[month], expected, "科目属性による施策別利益と集計マスタの階層計算が一致する");
    }
  }
  const unused = accounts.find(item => item.accountName === "削除確認用科目");
  assert.equal(unused.inUse, false);
  assert.equal((await changeAccountMaster(bytes, { type: "delete", id: unused.id })).accounts.length, 15);
  const blank = accounts.find(item => item.accountName === "未所属費用");
  assert.equal(blank.inUse, true);
  assert.ok(!aggregations.some(item => item.members.some(member => member.kind === "account" && member.id === blank.id)));
  await assert.rejects(changeAccountMaster(bytes, { type: "delete", id: blank.id }), /使用/);
  const disposable = aggregations.find(item => item.name === "編集・削除確認用集計");
  assert.equal((await readPlanContents(await changeAggregationMaster(bytes, { type: "delete", id: disposable.id }))).aggregations.length, 10);
  const database = await openTriadicDatabase(bytes);
  try {
    assert.equal(database.exec("SELECT count(*) FROM details WHERE actual_amount != 0 OR actual_sales_amount != 0 OR actual_profit_amount != 0")[0].values[0][0], 0);
    assert.deepEqual(database.exec("SELECT DISTINCT p.year, p.month FROM details d JOIN periods p ON d.period_id = p.id WHERE initiative_id = ? AND p.month IN (4, 3) ORDER BY p.year", [product.id])[0].values, [[2026, 4], [2027, 3]]);
  } finally { database.close(); }
  assert.equal((await readPlanContents(bytes)).accounts.length, 16, "削除確認後も元データを再利用できる");
  console.log("PASS: sample plan years, monthly edge cases, configured totals and editable/deletable master data");
}
