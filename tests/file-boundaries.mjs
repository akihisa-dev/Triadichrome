import assert from "node:assert/strict";

export async function verifyFileBoundaries(api) {
  const bytes = await api.createCurrentEmptyTestPlan(2026);
  await assert.rejects(api.validateTriadicDatabase(new Uint8Array([1, 2, 3])));
  for (const format of [14, 15, 16, 18]) {
    const old = await api.openTriadicDatabase(bytes);
    old.run(`PRAGMA user_version = ${format}`);
    const unsupported = old.export(); old.close();
    await assert.rejects(api.validateTriadicDatabase(unsupported), /保存形式には対応/);
  }
  for (const table of ["data_history", "data_history_state"]) {
    const missing = await api.openTriadicDatabase(bytes); missing.run(`DROP TABLE ${table}`);
    const invalid = missing.export(); missing.close(); await assert.rejects(api.validateTriadicDatabase(invalid));
  }
  const schema = await api.openTriadicDatabase(bytes);
  try {
    assert.equal(schema.exec("PRAGMA user_version")[0].values[0][0], 17);
    for (const table of ["plan", "budgets", "periods", "kind_types", "details"]) assert.equal(schema.exec("SELECT name FROM sqlite_master WHERE name = ?", [table]).length, 0);
    const info = schema.exec("SELECT id, fiscal_year, created_at, updated_at FROM document_info")[0].values;
    assert.equal(info.length, 1);
    assert.deepEqual(info[0].slice(0, 2), [1, 2026]);
    assert.equal(info[0][2], info[0][3]);
    assert.ok(Number.isFinite(Date.parse(info[0][2])));
    assert.throws(() => schema.run("INSERT INTO document_info SELECT * FROM document_info"), /UNIQUE/);
    assert.equal(schema.exec("PRAGMA table_info(initiatives)")[0].values.some(row => row[1] === "fiscal_year" || row[1] === "budget_id"), false);
    assert.equal(schema.exec("PRAGMA table_info(amount_overrides)")[0].values.some(row => row[1] === "kind_id"), false);
  } finally { schema.close(); }
  const db = await api.openTriadicDatabase(bytes);
  db.run("DELETE FROM document_info");
  const invalid = db.export(); db.close();
  await assert.rejects(api.validateTriadicDatabase(invalid));
  for (const stage of ["write", "close"]) {
    let aborted = false;
    await assert.rejects(api.writeTriadicFile({ async createWritable() { return {
      async write() { if (stage === "write") throw new Error("保存失敗"); },
      async close() { if (stage === "close") throw new Error("保存失敗"); },
      async abort() { aborted = true; },
    }; } }, bytes), /保存失敗/);
    assert.equal(aborted, true);
  }
  let master = await api.changeAccountMaster(bytes, { type: "add", accountType: "sales", accountCode: "001", accountName: " 売上 " });
  assert.equal(master.accounts[0].accountName, "売上");
  assert.equal(master.accounts[0].accountCode, "001");
  assert.deepEqual(await api.readAccountMaster(bytes), []);
  for (const accountCode of ["", "12", "1234", "1a3", "１２３", "-10", "1.0"]) await assert.rejects(api.changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode, accountName: "無効" }), /半角数字3桁/);
  await assert.rejects(api.changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "002", accountName: "売上" }), /同じ名前/);
  await assert.rejects(api.changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "001", accountName: "別科目" }), /同じ科目コード/);
  const contents = await api.readPlanContents(master.bytes);
  const prior = await api.savePreviousAmounts(master.bytes, { industryId: contents.industries[0].id, departmentId: contents.departments[0].id, rows: [{ accountId: master.accounts[0].id, amounts: { 4: "0" } }] });
  for (const [change, id] of [[api.changeAccountMaster, master.accounts[0].id], [api.changeIndustryMaster, contents.industries[0].id], [api.changeDepartmentMaster, contents.departments[0].id]]) await assert.rejects(change(prior, { type: "delete", id }), /前年|使用/);
  let stored = master.bytes;
  let writes = 0;
  const handle = { name: "確認.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() { let pending; return {
    async write(value) { pending = value; writes++; }, async close() { stored = new Uint8Array(pending); }, async abort() {},
  }; } };
  const plan = { ...await api.readPlanContents(stored), bytes: stored, name: handle.name, handle };
  const changed = await api.saveKindSelection(stored, "initiative-list", [1]);
  const saved = await api.writePlanChange(plan, handle, changed);
  assert.deepEqual((await api.readPlanContents(stored)).kindSelections["initiative-list"], [1]);
  await assert.rejects(api.writePlanChange(plan, handle, changed), /別の操作で更新/);
  assert.equal(writes, 1);
  const beforeFailure = stored.slice();
  const failing = { ...handle, async createWritable() { return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} }; } };
  await assert.rejects(api.writePlanChange(saved, failing, await api.saveKindSelection(stored, "cost-table", [1, 2])), /保存失敗/);
  assert.deepEqual(stored, beforeFailure);
  await assert.rejects(api.writePlanChange(saved, { ...handle, name: "確認.txt" }, changed), /拡張子/);
  // Two independent handles share a file and an exclusive writer lock.
  stored = master.bytes;
  let locked = false;
  let releaseRead;
  let readEntered;
  const entered = new Promise(resolve => { readEntered = resolve; });
  const gate = new Promise(resolve => { releaseRead = resolve; });
  const concurrentHandle = () => ({ name: "確認.triadic",
    async createWritable(options) {
      assert.equal(options.mode, "exclusive");
      if (locked) throw new DOMException("locked", "NoModificationAllowedError");
      locked = true;
      let pending;
      return {
        async write(value) { pending = value; },
        async close() { stored = new Uint8Array(pending); locked = false; },
        async abort() { locked = false; },
      };
    },
    async getFile() {
      assert.equal(locked, true, "最新内容は排他確保後に読む");
      readEntered(); await gate;
      return new File([stored], this.name);
    },
  });
  const firstHandle = concurrentHandle(), secondHandle = concurrentHandle();
  const base = { ...await api.readPlanContents(stored), bytes: stored, name: firstHandle.name, handle: firstHandle };
  const firstWrite = api.writePlanChange(base, firstHandle, changed);
  await entered;
  const otherChange = await api.saveKindSelection(base.bytes, "cost-table", [1, 2]);
  await assert.rejects(api.writePlanChange({ ...base, handle: secondHandle }, secondHandle, otherChange), /保存中/);
  releaseRead();
  const winner = await firstWrite;
  assert.deepEqual(stored, winner.bytes);
  await assert.rejects(api.writePlanChange({ ...base, handle: secondHandle }, secondHandle, otherChange), /別の操作で更新/);
  assert.equal(locked, false, "照合失敗でも排他を解放");
  const retried = await api.writePlanChange({ ...winner, handle: secondHandle }, secondHandle, await api.saveKindSelection(winner.bytes, "cost-table", [1, 2]));
  assert.deepEqual(stored, retried.bytes);
  console.log("PASS: 不正ファイル、円精度、前年参照の削除保護、保存確定失敗、競合時の非上書き");
}
