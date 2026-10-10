import assert from "node:assert/strict";
export async function verifyClassificationStorage(api) {
  const original = await api.createTriadicDatabase(2026);
  const initial = await api.readPlanContents(original);
  for (const items of [initial.industries, initial.departments]) {
    assert.ok(items.every(item => /^[0-9a-f]{32}$/.test(item.identity)));
    assert.equal(new Set(items.map(item => item.identity)).size, items.length);
  }
  for (const [table, key, change, add, rename] of [
    ["industries", "industries", api.changeIndustryMaster, {type:"add",industryCode:"999",industryName:"作成確認"}, item => ({type:"update",id:item.id,industryCode:"999",industryName:"改名確認"})],
    ["departments", "departments", api.changeDepartmentMaster, {type:"add",departmentName:"作成確認",industryIds:[1]}, item => ({type:"update",id:item.id,departmentName:"改名確認",industryIds:[1,2]})],
  ]) {
    let bytes = await change(original, add);
    const created = (await api.readPlanContents(bytes))[key].at(-1);
    bytes = await change(bytes, rename(created));
    assert.equal((await api.readPlanContents(bytes))[key].find(item => item.id === created.id).identity, created.identity);
    const snapshot = await api.createBusinessSnapshot(bytes);
    bytes = await change(bytes, {type:"delete",id:created.id});
    bytes = await change(bytes, add);
    const recreated = (await api.readPlanContents(bytes))[key].find(item => item.id === created.id);
    assert.ok(recreated, "同じ数値IDを再利用する");
    assert.notEqual(recreated.identity, created.identity);
    const restored = await api.applyOperationSnapshot(bytes, snapshot);
    assert.equal((await api.readPlanContents(restored))[key].find(item => item.id === created.id).identity, created.identity);
    const db = await api.openTriadicDatabase(restored);
    try {
      assert.equal(db.exec("SELECT key FROM triadic_metadata WHERE key LIKE '%_identity:%'").length, 0);
      assert.throws(() => db.run(`UPDATE ${table} SET identity = NULL WHERE id = ?`, [created.id]), /NOT NULL/);
      assert.throws(() => db.run(`UPDATE ${table} SET identity = 'legacy' WHERE id = ?`, [created.id]), /CHECK/);
      assert.throws(() => db.run(`UPDATE ${table} SET identity = (SELECT identity FROM ${table} WHERE id = 1) WHERE id = ?`, [created.id]), /UNIQUE/);
      db.run("INSERT INTO triadic_metadata(key,value) VALUES (?, 'legacy')", [table + "_identity:" + created.id]);
      const invalid = db.export(); const before = invalid.slice();
      await assert.rejects(api.openTriadicDatabase(invalid)); assert.deepEqual(invalid, before);
    } finally { db.close(); }
  }
  assert.deepEqual(await api.readPlanContents(original), initial);
  console.log("PASS: 分類行の必須・一意作成識別子、改名・所属、ID再利用、復元、旧メタデータ拒否と元bytes保護");
}
