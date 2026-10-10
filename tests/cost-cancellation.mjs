import assert from "node:assert/strict";

export async function verifyCostCancellation(api) {
  const original = await api.createTriadicDatabase(2026);
  const defaults = await api.readPlanContents(original);
  const sales = defaults.accounts.find(account => account.accountType === "sales");
  const maximum = Number.MAX_SAFE_INTEGER;
  const permutations = [[1, 1, -1], [1, -1, 1], [-1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
  const baseDraft = { ...api.createInitiativeDraft("2026"), name: "相殺の境界確認", expansionId: 1, industryId: 1, departmentId: 1 };
  for (const signs of permutations) {
    const expected = signs.reduce((sum, sign) => sum + sign, 0) * maximum;
    const rows = signs.map(sign => ({ accountId: sales.id, amounts: { 4: api.yenToAmount(sign * maximum) }, overrides: { 2: { 4: api.yenToAmount(sign * (maximum - 1)) } } }));
    const draft = { ...baseDraft, rows };
    const bytes = await api.registerInitiative(original, draft);
    const plan = await api.readPlanContents(bytes);
    for (const kind of [1, 2]) {
      const target = kind === 1 ? expected : expected - Math.sign(expected);
      const projected = api.initiativesForKind(plan.initiatives, plan.accounts, kind);
      assert.equal(projected[0].months[4].sales, target);
      assert.equal(api.initiativeTotals(projected)[4].sales, target);
      assert.equal(api.initiativeAmountTotals(draft, kind, plan.accounts).rows.find(row => row.name === "売上").amounts[4], target);
      const table = api.buildCostComparison(plan, [kind]);
      assert.equal(table.rows.find(row => row.id === sales.id && row.kind === "account").values[1][4], target);
      assert.equal(table.rows.find(row => row.kind === "group" && row.id === plan.aggregations.find(group => group.required === "sales").id).values[1][4], target);
    }
    const both = api.buildCostComparison(plan, [1, 2]).rows.find(row => row.id === sales.id && row.kind === "account");
    assert.deepEqual(both.values.map(values => values[4]), [0, expected, expected - Math.sign(expected), expected - Math.sign(expected), -Math.sign(expected)]);
    const separate = { ...plan, initiatives: plan.initiatives[0].rows.map((row, index) => ({ ...plan.initiatives[0], id: index + 1, rows: [row] })) };
    assert.deepEqual(api.buildCostComparison(separate, [1, 2]), api.buildCostComparison(plan, [1, 2]), "施策を分けても同じ科目合計になる");
    const prior = { ...defaults, previousAmounts: signs.map((sign, index) => ({ accountId: sales.id, industryId: index + 1, departmentId: 1, month: 4, amount: api.yenToAmount(sign * maximum) })) };
    assert.equal(api.previousByAccount(prior).get(sales.id)[4], expected);
    assert.equal(api.previousTotals(prior)[4].sales, expected);
    // Distribute each signed term over different months: quarterly, half-year and annual sums must cancel.
    for (const start of [4, 7, 10, 1]) {
      const periodPlan = { ...plan, initiatives: [{ ...plan.initiatives[0], rows: [{ accountId: sales.id, amounts: Object.fromEntries(signs.map((sign, index) => [start + index, api.yenToAmount(sign * maximum)])) }] }] };
      const period = api.buildPeriodCostComparison(periodPlan, [1, 2]).rows.find(row => row.id === sales.id && row.kind === "account");
      for (const definition of api.tablePeriods.filter(period => period.months.includes(start) && period.months.length > 1)) {
        assert.equal(period.values[1][definition.id], expected);
        const months = api.initiativesForKind(periodPlan.initiatives, periodPlan.accounts, 1)[0].months;
        assert.equal(api.expansionPeriodAmount(months, definition, "sales"), expected);
      }
    }
    // Account and nested-group member order, including subtraction, cannot affect a completed group sum.
    const accounts = [sales, ...[9001, 9002].map(id => ({ ...sales, id, accountCode: String(id), accountName: `境界科目${id}` }))];
    const groups = api.initialAggregations();
    const salesGroup = groups.find(group => group.required === "sales");
    const nested = accounts.map((account, index) => ({ id: 100 + index, name: `境界集計${index}`, required: null, members: [{ kind: "account", id: account.id, sign: 1 }] }));
    salesGroup.members = nested.map((group, index) => ({ kind: "group", id: group.id, sign: signs[index] }));
    const multiAccountPrior = { ...defaults, accounts, previousAmounts: accounts.map((account, index) => ({ accountId: account.id, industryId: 1, departmentId: 1, month: 4, amount: api.yenToAmount(signs[index] * maximum) })) };
    assert.equal(api.previousTotals(multiAccountPrior)[4].sales, expected);
    const source = new Map(accounts.map(account => [account.id, { 4: maximum }]));
    const table = api.buildCostTable(accounts, [...groups, ...nested], [], 2026, source);
    assert.equal(table.find(row => row.kind === "group" && row.id === salesGroup.id).previous[4], expected);
    salesGroup.members.reverse();
    assert.equal(api.buildCostTable(accounts, [...groups, ...nested], [], 2026, source).find(row => row.kind === "group" && row.id === salesGroup.id).budget[4], expected);
    assert.deepEqual(await api.readPlanContents(bytes), plan, "表示用計算で保存データを変えない");
  }
  for (const sign of [1, -1]) {
    const seed = await api.readPlanContents(await api.registerInitiative(original, { ...baseDraft, rows: [{ accountId: sales.id, amounts: { 4: "0" } }] }));
    const bad = { ...seed, initiatives: [{ ...seed.initiatives[0], rows: [maximum, 1].map(value => ({ accountId: sales.id, amounts: { 4: api.yenToAmount(sign * value) } })) }] };
    assert.throws(() => api.buildCostComparison(bad, [1]), /範囲/);
    const periodBad = { ...seed, initiatives: [{ ...seed.initiatives[0], rows: [{ accountId: sales.id, amounts: { 4: api.yenToAmount(sign * maximum), 5: String(sign * 0.001) } }] }] };
    assert.throws(() => api.buildPeriodCostComparison(periodBad, [1]), /範囲/);
    const groups = api.initialAggregations();
    groups.find(group => group.required === "sales").members = [{ kind: "account", id: sales.id, sign: 1 }, { kind: "account", id: 9001, sign: 1 }];
    assert.throws(() => api.buildCostTable([sales, { ...sales, id: 9001 }], groups, [], 2026, new Map([[sales.id, { 4: sign * maximum }], [9001, { 4: sign }]])), /範囲/);
  }
  assert.throws(() => api.sumYen([0.5, -0.5]), /範囲/);
  assert.throws(() => api.sumYen([NaN]), /範囲/);
  assert.equal(api.sumYen([]), 0);
  console.log("PASS: 正負6順列、一次・確定、入力・一覧・総原価表、前年分類、子集計と符号、月・期間、真の超過とデータ保持");
}
