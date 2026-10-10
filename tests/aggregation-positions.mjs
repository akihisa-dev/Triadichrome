import assert from "node:assert/strict";

export async function verifyAggregationPositions(api) {
  const original = await api.createTriadicDatabase(2026);
  for (const data of [original, await api.createBusinessSnapshot(original)]) {
    const open = data === original ? api.openTriadicDatabase : api.openBusinessSnapshot;
    const old = await open(data);
    try {
      const ddl = old.exec("SELECT sql FROM sqlite_master WHERE name = 'aggregation_members'")[0].values[0][0];
      old.exec("PRAGMA writable_schema = ON");
      old.run("UPDATE sqlite_master SET sql = ? WHERE name = 'aggregation_members'", [ddl.replace(" CHECK (typeof(position) = 'integer' AND position BETWEEN 0 AND 9007199254740991)", "")]);
      old.exec("PRAGMA writable_schema = OFF; PRAGMA user_version = 23");
      old.run("UPDATE triadic_metadata SET value = '23' WHERE key = 'format_version'");
      const unsupported = old.export(), before = unsupported.slice();
      await assert.rejects(open(unsupported), /保存形式には対応/);
      assert.deepEqual(unsupported, before);
      old.exec(`PRAGMA user_version = ${api.TRIADIC_FORMAT_VERSION}`);
      old.run("UPDATE triadic_metadata SET value = ? WHERE key = 'format_version'", [String(api.TRIADIC_FORMAT_VERSION)]);
      const disguised = old.export(), unchanged = disguised.slice();
      await assert.rejects(open(disguised), /許可されていない保存構造/);
      assert.deepEqual(disguised, unchanged, "旧DDLの版番号偽装を拒否し元bytesを保持");
    } finally { old.close(); }
  }
  const initial = await api.readPlanContents(original);
  const [a, b] = initial.accounts;
  const db = await api.openTriadicDatabase(original);
  let base;
  try {
    db.run("DELETE FROM aggregation_members");
    db.run("INSERT INTO aggregation_members(parent_id, account_id, sign, position) VALUES (1, ?, 1, 7)", [a.id]);
    base = api.exportTriadicDatabase(db);
    for (const position of ["x", 0.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => db.run("UPDATE aggregation_members SET position = ?", [position]), /CHECK/, `DDLで不正順序 ${position} を拒否`);
      db.exec("PRAGMA ignore_check_constraints = ON");
      db.run("UPDATE aggregation_members SET position = ?", [position]);
      const invalid = db.export(), before = invalid.slice();
      await assert.rejects(api.openTriadicDatabase(invalid));
      assert.deepEqual(invalid, before, "不正ファイルの元bytesを変更しない");
      db.run("UPDATE aggregation_members SET position = 7");
      db.exec("PRAGMA ignore_check_constraints = OFF");
    }
  } finally { db.close(); }
  const move = (id, parentId, sign = 1) => ({ type: "move", member: { kind: "account", id }, parentId, sign });
  let bytes = await api.changeAggregationMaster(base, move(b.id, 1));
  const members = async data => (await api.readPlanContents(data)).aggregations.find(group => group.id === 1).members;
  assert.deepEqual((await members(bytes)).map(item => item.id), [a.id, b.id], "位置が飛んでも末尾へ追加");
  bytes = await api.changeAggregationMaster(bytes, move(a.id, 1, -1));
  assert.deepEqual(await members(bytes), [{ kind: "account", id: a.id, sign: -1 }, { kind: "account", id: b.id, sign: 1 }]);
  bytes = await api.changeAggregationMaster(bytes, move(a.id, null));
  bytes = await api.changeAggregationMaster(bytes, move(a.id, 1));
  assert.deepEqual((await members(bytes)).map(item => item.id), [b.id, a.id], "解除・再所属は末尾");
  const snapshot = await api.createBusinessSnapshot(bytes);
  assert.deepEqual((await api.readSnapshotContents(snapshot)).aggregations, (await api.readPlanContents(bytes)).aggregations);
  const boundary = await api.openTriadicDatabase(base);
  try {
    boundary.run("UPDATE aggregation_members SET position = ?", [Number.MAX_SAFE_INTEGER - 1]);
    const nearLimit = api.exportTriadicDatabase(boundary);
    const atLimit = await api.changeAggregationMaster(nearLimit, move(b.id, 1));
    assert.deepEqual((await members(atLimit)).map(item => item.id), [a.id, b.id]);
    const unchanged = atLimit.slice();
    const third = initial.accounts[2].id;
    await assert.rejects(api.changeAggregationMaster(atLimit, move(third, 1)), /所属順の上限/);
    assert.deepEqual(atLimit, unchanged, "採番失敗で元bytesを保持");
    const signed = await api.changeAggregationMaster(atLimit, move(b.id, 1, -1));
    assert.deepEqual((await members(signed)).map(item => item.id), [a.id, b.id], "採番上限でも符号変更で順序を動かさない");
  } finally { boundary.close(); }
  console.log("PASS: 集計所属順の型・安全な整数域、位置の飛び、末尾追加・符号変更・再所属、採番境界と入力保護");
}
