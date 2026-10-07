import assert from "node:assert/strict";
export function verifyPreviousGrid(api) {
  const draft = { industryId: 1, departmentId: 1, rows: [1, 2, 3].map(accountId => ({ accountId, amounts: { 4: "7", 5: "8", 3: "9" } })) };
  const before = structuredClone(draft);
  const ids = [1, 2, null, 3];
  const pasted = api.pastePreviousGrid(draft, ids, { row: 0, column: 0 }, "1,200.125\t-0.001\r\n\t0\r\n");
  assert.deepEqual(pasted.rows[0].amounts, { 4: "1200.125", 5: "-0.001", 3: "9" });
  assert.equal(pasted.rows[1].amounts[4], "0");
  assert.deepEqual(pasted.rows[2], draft.rows[2]);
  for (const text of ["1\t2\n3\t不正", "1\t2\n3", "1.0001", "12,34"]) assert.throws(() => api.pastePreviousGrid(draft, ids, { row: 0, column: 0 }, text));
  assert.throws(() => api.pastePreviousGrid(draft, ids, { row: 1, column: 0 }, "1\n2"), /小計/);
  assert.throws(() => api.pastePreviousGrid(draft, ids, { row: 0, column: 11 }, "1\t2"), /外/);
  assert.throws(() => api.pastePreviousGrid(draft, ids, { row: 3, column: 0 }, "1\n2"), /外/);
  assert.deepEqual(draft, before, "失敗と成功のいずれも入力元を変更しない");
  const selection = { anchor: { row: 3, column: 1 }, end: { row: 0, column: 0 } };
  const filled = api.fillPreviousGrid(draft, ids, selection, "-1.125");
  for (const row of filled.rows) { assert.equal(row.amounts[4], "-1.125"); assert.equal(row.amounts[5], "-1.125"); assert.equal(row.amounts[3], "9"); }
  assert.throws(() => api.fillPreviousGrid(draft, ids, selection, "NaN"));
  assert.equal(api.fillPreviousGrid(draft, ids, selection, "").rows[0].amounts[4], "0");
  const contents = { accounts: [{ id: 1 }, { id: 2 }], initiatives: [], previousAmounts: [
    { accountId: 1, industryId: 1, departmentId: 1, month: 4, amount: "0.1" },
    { accountId: 1, industryId: 1, departmentId: 2, month: 4, amount: "0.2" },
    { accountId: 1, industryId: 2, departmentId: 1, month: 4, amount: "-0.001" },
  ] };
  const total = (industries, departments) => api.previousByAccount(api.filterPlan(contents, { industries, departments }));
  assert.equal(total(null, null).get(1)[4], 299);
  assert.equal(total([1], null).get(1)[4], 300);
  assert.equal(total(null, [1]).get(1)[4], 99);
  assert.equal(total([1], [2]).get(1)[4], 200);
  assert.equal(total([2], [2]).get(1)[4], 0);
  assert.equal(total([1, 2], [1]).get(1)[4], 99);
  assert.equal(total([1, 2], [1, 2]).get(1)[4], 299);
  assert.equal(total([1, 2], [2]).get(1)[4], 200);
  assert.equal(total(null, null).get(2)[4], 0);
  assert.equal(total(null, null).get(1)[3], 0);

}
