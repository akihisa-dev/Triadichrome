import assert from "node:assert/strict";

export async function verifyPeriodTables(api) {
  const { tablePeriods: periods } = api;
  assert.deepEqual(periods.map(period => period.label), ["4月", "5月", "6月", "第1四半期計", "7月", "8月", "9月", "第2四半期計", "上期計", "10月", "11月", "12月", "第3四半期計", "1月", "2月", "3月", "第4四半期計", "下期計", "年間計"]);
  const contents = await api.readPlanContents(await api.createSamplePlan(2026));
  for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const monthly = api.buildCostComparison(contents, selected);
    const table = api.buildPeriodCostComparison(contents, selected);
    const sales = table.rows.find(row => row.kind === "group" && row.id === contents.aggregations.find(group => group.required === "sales").id);
    const profit = table.rows.find(row => row.kind === "group" && row.id === contents.aggregations.find(group => group.required === "ordinary").id);
    for (const [index, row] of table.rows.entries()) for (const period of periods) {
      if (period.months.length === 1) {
        assert.deepEqual(row.values.map(value => value[period.id]), monthly.rows[index].values.map(value => value[period.months[0]]));
      } else if (!row.configured) {
        assert.ok(row.values.every(value => value[period.id] === undefined));
      } else if (row.kind !== "ratio") {
        row.values.forEach((value, column) => assert.equal(value[period.id], period.months.reduce((sum, month) => api.addYen(sum, monthly.rows[index].values[column][month] ?? 0), 0)));
      } else {
        for (let column = 0; column <= selected.length; column++) {
          const denominator = sales.values[column][period.id];
          assert.equal(row.values[column][period.id], denominator === 0 ? undefined : profit.values[column][period.id] / denominator * 100);
        }
        const final = row.values[selected.length][period.id];
        assert.equal(row.values[selected.length + 1][period.id], final - row.values[0][period.id]);
        if (selected.length === 2) assert.equal(row.values[4][period.id], final - row.values[1][period.id]);
      }
    }
    const expansion = api.buildKindExpansionTable(contents, selected, "registered");
    const item = expansion.groups.flatMap(group => group.initiatives).find(item => item.name === "確定予算の下期調整");
    for (const [column, kind] of selected.entries()) {
      assert.equal(api.expansionPeriodAmount(item.values[column], periods.find(period => period.id === "quarter-3"), "sales"), kind === 1 ? 300000 : 350000);
      assert.equal(api.expansionPeriodAmount(item.values[column], periods.find(period => period.id === "annual"), "sales"), kind === 1 ? 1200000 : 1250000);
    }
    if (selected.length === 2) assert.equal(api.expansionPeriodAmount(item.values[2], periods.find(period => period.id === "annual"), "sales"), 50000);
  }
  const annual = periods.find(period => period.id === "annual");
  const upper = periods.find(period => period.id === "half-1");
  const quarter = periods.find(period => period.id === "quarter-1");
  assert.equal(api.expansionPeriodAmount({ 4: { sales: 100, profit: -100 }, 5: { sales: 200, profit: -200 } }, annual, "sales"), 300);
  assert.equal(api.expansionPeriodAmount({ 4: { sales: 100, profit: -100 }, 5: { sales: 200, profit: -200 } }, annual, "profit"), -300);
  assert.equal(api.expansionPeriodAmount({ 10: { sales: null, profit: null } }, upper, "sales"), 0);
  assert.equal(api.expansionPeriodAmount({ 10: { sales: null, profit: null } }, annual, "sales"), null);
  const zero = api.buildPeriodCostComparison(await api.readPlanContents(await api.createTriadicDatabase(2026)), [1, 2]);
  assert.ok(zero.rows.find(row => row.kind === "ratio").values.every(value => value.annual === undefined));
  const filtered = api.filterPlan(contents, { industries: [1], departments: [1] });
  const table = api.buildPeriodCostComparison(filtered, [1, 2]);
  assert.equal(table.rows.find(row => row.name === "売上高").values[0][upper.id], 6000000);
  // Different month weights: the period rate is neither a sum nor an average of monthly rates.
  const synthetic = { ...filtered, initiatives: [], previousAmounts: [], accounts: contents.accounts.filter(account => ["売上高", "給料手当"].includes(account.accountName)) };
  const salesId = synthetic.accounts.find(account => account.accountName === "売上高").id;
  const expenseId = synthetic.accounts.find(account => account.accountName === "給料手当").id;
  synthetic.aggregations = [
    { id: 1, name: "売上集計", required: "sales", members: [{ kind: "account", id: salesId, sign: 1 }] },
    { id: 2, name: "費用集計", required: "expenses", members: [{ kind: "account", id: expenseId, sign: 1 }] },
    { id: 3, name: "営業利益", required: "operating", members: [{ kind: "group", id: 1, sign: 1 }, { kind: "group", id: 2, sign: -1 }] },
    { id: 4, name: "経常利益", required: "ordinary", members: [{ kind: "group", id: 3, sign: 1 }] },
  ];
  synthetic.previousAmounts = [[salesId, 4, "100"], [salesId, 5, "300"], [expenseId, 4, "50"], [expenseId, 5, "60"]].map(([accountId, month, amount]) => ({ accountId, month, amount, industryId: 1, departmentId: 1 }));
  assert.equal(api.buildPeriodCostComparison(synthetic, [1]).rows.find(row => row.kind === "ratio").values[0][quarter.id], 72.5);
}
