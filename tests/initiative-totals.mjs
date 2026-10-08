import assert from "node:assert/strict";

export function verifyInitiativeTotals(api) {
  const source = [
    { months: { 4: { sales: 499, expense: -1001, profit: 1500 } } },
    { months: { 4: { sales: 499, expense: 499, profit: 0 } } },
  ];
  const snapshot = structuredClone(source);
  const totals = api.initiativeTotals(source);
  assert.deepEqual(totals[4], { sales: 998, expense: -502, profit: 1500 });
  assert.equal(api.formatYen(totals[4].sales), "1", "施策別の丸め後の値ではなく1円単位で合算");
  assert.equal(api.formatYen(totals[4].expense), "-1", "削減の負数を維持");
  assert.deepEqual(totals[5], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(api.initiativeTotals([])[4], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(api.initiativeTotals([...source].reverse()), totals, "並べ替えによらず同じ合計");
  assert.deepEqual(source, snapshot, "元の施策を変更しない");
  assert.deepEqual(api.initiativeTotals([...source, { months: { 4: { sales: null, expense: 1, profit: null } } }])[4],
    { sales: null, expense: -501, profit: null });
  const huge = { months: { 4: { sales: Number.MAX_SAFE_INTEGER, expense: 0, profit: 0 } } };
  assert.equal(api.initiativeTotals([huge])[4].sales, Number.MAX_SAFE_INTEGER);
  assert.throws(() => api.initiativeTotals([huge, ...source]), /範囲を超え/);
  assert.throws(() => api.initiativeTotals([{ months: { 4: { sales: 1.5, expense: 0, profit: 0 } } }]), /範囲を超え/);
}
