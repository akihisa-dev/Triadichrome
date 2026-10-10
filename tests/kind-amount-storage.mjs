import assert from "node:assert/strict";

export async function verifyKindAmountStorage(api) {
  const original = await api.createTriadicDatabase(2026);
  const contents = await api.readPlanContents(original);
  const draft = { ...api.createInitiativeDraft("2026"), name: "種別別保存確認", expansionId: contents.expansions[0].id,
    industryId: contents.industries[0].id, departmentId: contents.departments[0].id,
    rows: [{ accountId: contents.accounts[0].id, amounts: { 4: "100", 5: "20", 6: "50" }, overrides: { 2: { 4: "100", 5: "0", 6: "50" } } }] };
  let bytes = await api.registerInitiative(original, draft);
  const registered = await api.readPlanContents(bytes);
  const initiative = registered.initiatives[0];
  const row = initiative.rows[0];
  const db = await api.openTriadicDatabase(bytes);
  try {
    assert.deepEqual(db.exec("SELECT kind_id, COUNT(*) FROM initiative_amounts GROUP BY kind_id ORDER BY kind_id")[0].values, [[1, 12], [2, 3]]);
    assert.deepEqual(db.exec("SELECT kind_id, amount_yen FROM initiative_amounts WHERE row_id = ? AND month = 4 ORDER BY kind_id", [row.id])[0].values, [[1,100000],[2,100000]]);
    assert.equal(db.exec("SELECT name FROM sqlite_master WHERE name = 'amount_overrides'").length, 0);
    assert.throws(() => db.run("INSERT INTO initiative_amounts(row_id,kind_id,month) VALUES (?,1,4)", [row.id]), /UNIQUE/);
    assert.throws(() => db.run("INSERT INTO initiative_amounts(row_id,kind_id,month) VALUES ('孤児',2,4)"), /FOREIGN/);
    assert.throws(() => db.run("INSERT INTO initiative_amounts(row_id,kind_id,month) VALUES (?,3,4)", [row.id]), /CHECK/);
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.run("UPDATE initiative_amounts SET kind_id = 3 WHERE row_id = ? AND kind_id = 2 AND month = 6", [row.id]);
    const invalid = db.export(); const before = invalid.slice();
    await assert.rejects(api.openTriadicDatabase(invalid));
    assert.deepEqual(invalid, before);
  } finally { db.close(); }
  const snapshot = await api.createBusinessSnapshot(bytes);
  bytes = await api.updateInitiative(bytes, initiative.id, 2026, { ...draft, rows: [{ ...row, amounts: { ...row.amounts, 4: "120", 5: "25" } }] });
  let updated = (await api.readPlanContents(bytes)).initiatives[0].rows[0];
  assert.equal(api.resolvedAmount(updated, 2, 4), "100", "同額で明示した100も固定する");
  assert.equal(api.resolvedAmount(updated, 2, 5), "0", "明示0を不在と混同しない");
  const stale = (await api.readPlanContents(bytes)).details.find(item => item.kindId === 2 && item.month === 4);
  const reset = { ...updated, overrides: { 2: { 5: "0", 6: "50" } } };
  bytes = await api.updateInitiative(bytes, initiative.id, 2026, { ...draft, rows: [reset] });
  updated = (await api.readPlanContents(bytes)).initiatives[0].rows[0];
  assert.equal(api.resolvedAmount(updated, 2, 4), "120", "解除で一次へ戻る");
  assert.equal(updated.overrides[2][4], undefined);
  bytes = await api.updateInitiative(bytes, initiative.id, 2026, { ...draft, rows: [{ ...updated, overrides: { ...updated.overrides, 2: { ...updated.overrides[2], 4: "100" } } }] });
  await assert.rejects(api.changeDetail(bytes, { target: stale, field: "amount", value: "101" }), /変更されています/, "解除・再追加で明細revisionが戻っても古い編集を拒否する");
  const restored = await api.applyOperationSnapshot(bytes, snapshot);
  assert.deepEqual((await api.readPlanContents(restored)).initiatives[0].rows, [row]);
  // Construct the old storage shape only inside synthetic test copies, never migrate a user file.
  for (const [base, open] of [[original, api.openTriadicDatabase], [await api.createBusinessSnapshot(original), api.openBusinessSnapshot]]) {
    const legacy = await open(base);
    try {
      legacy.exec(`PRAGMA foreign_keys = OFF; DROP TABLE initiative_amounts;
        CREATE TABLE initiative_amounts (row_id TEXT NOT NULL REFERENCES initiative_rows(id), month INTEGER NOT NULL, amount_yen INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(row_id,month));
        CREATE TABLE amount_overrides (row_id TEXT NOT NULL REFERENCES initiative_rows(id) ON DELETE CASCADE, month INTEGER NOT NULL, amount_yen INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(row_id,month));
        PRAGMA user_version = 18; UPDATE triadic_metadata SET value = '18' WHERE key = 'format_version';`);
      const old = legacy.export(); const before = old.slice();
      await assert.rejects(open(old), /対応していません/);
      assert.deepEqual(old, before);
      legacy.exec(`PRAGMA user_version = ${api.TRIADIC_FORMAT_VERSION}; UPDATE triadic_metadata SET value = '${api.TRIADIC_FORMAT_VERSION}' WHERE key = 'format_version';`);
      const spoofed = legacy.export(); const spoofedBefore = spoofed.slice();
      await assert.rejects(open(spoofed), /許可されていない保存構造/);
      assert.deepEqual(spoofed, spoofedBefore);
    } finally { legacy.close(); }
  }
  assert.deepEqual(await api.readPlanContents(original), contents);
  console.log("PASS: 種別別単一金額表、12か月と疎な明示値、同額・0・解除・再追加競合、重複・孤児・不正種別、旧形式と偽装版の拒否");
}
