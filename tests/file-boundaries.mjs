import assert from "node:assert/strict";

export async function verifyFileBoundaries(api) {
  const bytes = await api.createCurrentEmptyTestPlan(2026);
  await assert.rejects(api.validateTriadicDatabase(new Uint8Array([1, 2, 3])));
  const db = await api.openTriadicDatabase(bytes);
  db.run("DELETE FROM budgets");
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
  const changed = await api.saveKindSelection(stored, "initiative-list", [5]);
  const saved = await api.writePlanChange(plan, handle, changed);
  assert.deepEqual((await api.readPlanContents(stored)).kindSelections["initiative-list"], [5]);
  await assert.rejects(api.writePlanChange(plan, handle, changed), /別の操作で更新/);
  assert.equal(writes, 1);
  const beforeFailure = stored.slice();
  const failing = { ...handle, async createWritable() { return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} }; } };
  await assert.rejects(api.writePlanChange(saved, failing, await api.setRevisedBudgetActive(stored, true)), /保存失敗/);
  assert.deepEqual(stored, beforeFailure);
  await assert.rejects(api.writePlanChange(saved, { ...handle, name: "確認.txt" }, changed), /拡張子/);
  console.log("PASS: 不正ファイル、円精度、前年参照の削除保護、保存確定失敗、競合時の非上書き");
}
