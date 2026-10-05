import assert from "node:assert/strict";

export async function verifySamplePlan(api) {
  const { createSamplePlan, validateTriadicDatabase, readPlanContents, buildCostTable, initiativeMonths, changeAccountMaster, changeAggregationMaster, openTriadicDatabase } = api;
  const bytes = await createSamplePlan(2026);
  await validateTriadicDatabase(bytes);
  const { accounts, initiatives, aggregations, expansions, industries } = await readPlanContents(bytes);
  assert.deepEqual(expansions.map(item => item.expansionCode), ["1", "2", "3", "4", "5", "8", "9"]);
  assert.deepEqual((await readPlanContents(bytes)).departments.map(item => item.departmentName), ["部署A", "部署B"]);
  assert.deepEqual((await readPlanContents(bytes)).periodTypes.map(item => item.periodName), ["期間差", "新規"]);
  assert.deepEqual(new Set(initiatives.map(item => item.periodTypeId)), new Set([1, 2]));
  assert.deepEqual(industries.map(item => item.industryName), ["直営自動車", "自動車取扱", "不動産A", "不動産B", "納品代行", "雑作業", "業務費B", "一般管理費", "営業外"]);
  assert.equal(accounts.length, 59);
  assert.equal(aggregations.length, 16);
  assert.equal(initiatives.length, 13);
  assert.equal(initiatives.find(item => item.name === "助成金の受入れ").departmentId, null, "ホームで部署未選択の構成を確認できる");
  assert.deepEqual(new Set(accounts.map(account => account.accountType)), new Set(["sales", "cost", "expense", "profit"]));
  assert.equal(accounts[0].accountCode, "401");
  assert.deepEqual([...new Set(initiatives.map(item => item.fiscalYear))].sort(), [2025, 2026, 2027]);
  const product = initiatives.find(item => item.name === "既存商品の販売拡大");
  assert.equal(product.rows[0].accountId, product.rows[1].accountId);
  assert.equal(product.rows[0].amounts[4], "120000");
  assert.equal(product.rows[0].amounts[3], "175000");
  assert.equal(product.months[4].sales, 90000);
  assert.equal(product.months[4].profit, 79125.501);
  const zero = initiatives.find(item => item.name === "ゼロと相殺の確認");
  assert.deepEqual(zero.months[4], { sales: 0, profit: 0 });
  assert.deepEqual(zero.months[5], { sales: 0, profit: 0 });
  assert.deepEqual(zero.months[6], { sales: 0, profit: 0 });
  assert.equal(initiatives.find(item => item.name === "通信運搬費と消耗品費の削減").months[4].profit, 3750.75);
  for (const year of [2025, 2026, 2027]) {
    const table = buildCostTable(accounts, aggregations, initiatives, year);
    assert.ok(table.every(item => Object.keys(item.previous).length === 0), "別年度の施策を前年合計値にしない");
    assert.ok(table.filter(item => item.required).every(item => item.configured), "必須4集計をすぐ確認できる");
    const ordinary = table.find(item => item.name === "経常利益");
    for (const month of initiativeMonths) {
      const expected = initiatives.filter(item => item.fiscalYear === year).reduce((total, item) => total + (item.months[month]?.profit ?? 0), 0);
      assert.equal(ordinary.budget[month], Math.round(expected * 1000) / 1000, "科目属性による施策別利益と集計マスタの階層計算が一致する");
    }
  }
  const unused = accounts.find(item => item.accountName === "削除確認用科目");
  assert.equal(unused.inUse, false);
  assert.equal((await changeAccountMaster(bytes, { type: "delete", id: unused.id })).accounts.length, 58);
  const blank = accounts.find(item => item.accountName === "未所属費用");
  assert.equal(blank.inUse, true);
  assert.ok(!aggregations.some(item => item.members.some(member => member.kind === "account" && member.id === blank.id)));
  await assert.rejects(changeAccountMaster(bytes, { type: "delete", id: blank.id }), /使用/);
  const disposable = aggregations.find(item => item.name === "編集・削除確認用集計");
  assert.equal((await readPlanContents(await changeAggregationMaster(bytes, { type: "delete", id: disposable.id }))).aggregations.length, 15);
  const database = await openTriadicDatabase(bytes);
  try {
    assert.deepEqual(database.exec("SELECT created_at, updated_at FROM budgets")[0].values, [["2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z"]], "確認用の作成・更新日時を再生成のたびに変更しない");
    assert.equal(database.exec("SELECT count(*) FROM details WHERE actual_amount != 0 OR actual_sales_amount != 0 OR actual_profit_amount != 0")[0].values[0][0], 0);
    assert.deepEqual(database.exec("SELECT DISTINCT p.year, p.month FROM details d JOIN periods p ON d.period_id = p.id WHERE initiative_id = ? AND p.month IN (4, 3) ORDER BY p.year", [product.id])[0].values, [[2026, 4], [2027, 3]]);
  } finally { database.close(); }
  assert.equal((await readPlanContents(bytes)).accounts.length, 59, "削除確認後も元データを再利用できる");
  console.log("PASS: sample plan years, monthly edge cases, configured totals and editable/deletable master data");
}
