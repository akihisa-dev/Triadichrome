import assert from "node:assert/strict";

export function verifyAggregationOrder(api) {
  const accounts = [10, 20, 30].map(id => ({ id, accountCode: String(id), accountName: `科目${id}`, accountType: "sales" }));
  const groups = api.initialAggregations();
  const [sales, expenses, operating, ordinary] = groups;
  const member = (kind, id, sign = 1) => ({ kind, id, sign });
  sales.members = [member("group", 101), member("group", 102, -1)];
  operating.members = [member("group", sales.id), member("group", expenses.id, -1)];
  ordinary.members = [member("group", operating.id)];
  groups.push(
    { id: 102, name: "費用小計", required: null, members: [member("account", 20), member("group", 103, -1)] },
    { id: 101, name: "売上小計", required: null, members: [member("account", 10)] },
    { id: 103, name: "控除", required: null, members: [member("account", 30)] },
  );
  const source = new Map([[10, { 4: 120000 }], [20, { 4: 30000 }], [30, { 4: 10000 }]]);
  const original = structuredClone({ accounts, groups, source });
  const table = api.buildCostTable(accounts, groups, [], 2026, source);
  const rows = table.filter(row => row.kind !== "ratio");
  assert.deepEqual(rows.map(({ kind, id }) => [kind, id]), [
    ["account", 10], ["group", 101], ["account", 20], ["account", 30],
    ["group", expenses.id], ["group", 103], ["group", 102], ["group", sales.id],
    ["group", operating.id], ["group", ordinary.id],
  ], "同じ科目位置に属する集計も、既存の子から親への順序を保つ");
  assert.deepEqual(rows.map(({ kind, id }) => ({ kind, id })), api.orderedMasterRows(accounts, groups));
  assert.equal(rows.find(row => row.kind === "group" && row.id === sales.id).budget[4], 100000);
  for (const id of [expenses.id, operating.id, ordinary.id]) {
    const row = rows.find(row => row.kind === "group" && row.id === id);
    assert.equal(row.configured, false);
    assert.deepEqual(row.budget, {}, "未設定の子集計を含む親に部分合計を表示しない");
  }
  // Persisted presentation order takes precedence over the calculation order.
  const order = api.orderedMasterRows(accounts, groups).reverse();
  const ranked = items => items.map(item => ({ ...item, masterOrder: order.findIndex(row => row.id === item.id) }));
  const explicit = api.buildCostTable(ranked(accounts), ranked(groups), [], 2026, source);
  assert.deepEqual(explicit.filter(row => row.kind !== "ratio").map(({ kind, id }) => ({ kind, id })), order);
  assert.deepEqual({ accounts, groups, source }, original, "計算で入力や保存順を変えない");

  // Parent-first definitions must also work without recursive stack growth.
  const depth = 12000;
  const nested = Array.from({ length: depth }, (_, index) => ({
    id: 100 + index, name: `階層${index}`, required: null,
    members: [index === depth - 1 ? member("account", 10) : member("group", 101 + index)],
  }));
  const deepGroups = api.initialAggregations();
  deepGroups[0].members = [member("group", 100)];
  const deepTable = api.buildCostTable([accounts[0]], [...deepGroups, ...nested], [], 2026, source);
  assert.equal(deepTable.find(row => row.kind === "group" && row.id === deepGroups[0].id).budget[4], 120000);
  assert.equal(deepTable.filter(row => row.kind === "group").length, depth + deepGroups.length);
  console.log("PASS: 集計の同位置順序、保存順優先、入れ子の加減算、未設定の伝播、12,000階層、入力保持");
}
