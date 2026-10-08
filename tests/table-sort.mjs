import assert from "node:assert/strict";

export function verifyTableSort({ sortTableRows }) {
  const rows = [
    { id: 1, name: "施策10", month: "2027-01", amount: "0.002" },
    { id: 2, name: "施策2", month: "2026-12", amount: "0.001" },
    { id: 3, name: "施策2", month: "2026-12", amount: "-10" },
    { id: 4, name: "", month: "", amount: null },
    { id: 5, name: null, month: null, amount: "0.001" },
  ];
  const before = structuredClone(rows);
  const columns = [
    { id: "name", value: row => row.name },
    { id: "month", value: row => row.month },
    { id: "amount", amount: true, numeric: true, value: row => row.amount },
    { id: "id", numeric: true, value: row => row.id },
  ];
  const ids = (column, direction) => sortTableRows(rows, columns, { column, direction }).map(row => row.id);
  for (const column of ["name", "month"]) {
    assert.deepEqual(ids(column, "ascending"), [2, 3, 1, 4, 5]);
    assert.deepEqual(ids(column, "descending"), [1, 2, 3, 4, 5]);
  }
  assert.deepEqual(ids("amount", "ascending"), [3, 2, 5, 1, 4], "負数・1円差・同値・未設定を区別する");
  assert.deepEqual(ids("amount", "descending"), [1, 2, 5, 3, 4]);
  assert.deepEqual(ids("id", "descending"), [5, 4, 3, 2, 1]);
  assert.equal(sortTableRows(rows, columns, null), rows);
  assert.deepEqual(sortTableRows([], columns, { column: "amount", direction: "ascending" }), []);
  assert.deepEqual(rows, before, "元データの順序と値を保持する");
}
