import assert from "node:assert/strict";

export async function verifyIndustryData(api) {
  const { createTriadicDatabase, readPlanContents, changeIndustryMaster, saveIndustryMaster, openTriadicDatabase, changeAccountMaster, validateTriadicDatabase } = api;
  const bytes = await createTriadicDatabase();
  const initial = (await readPlanContents(bytes)).industries;
  assert.deepEqual(initial.map(item => [item.industryCode, item.industryName]), [
    ["1", "直営自動車"], ["2", "自動車取扱"], ["3", "不動産A"], ["4", "不動産B"], ["5", "納品代行"], ["6", "雑作業"], ["7", "業務費B"], ["8", "一般管理費"], ["9", "営業外"],
  ]);
  let changed = await changeIndustryMaster(bytes, { type: "add", industryCode: "010", industryName: "追加確認" });
  assert.equal((await readPlanContents(changed)).industries.at(-1).industryCode, "010");
  for (const code of ["", "１", "-1", "1.2", "a"]) await assert.rejects(changeIndustryMaster(bytes, { type: "add", industryCode: code, industryName: "無効" }), /半角数字/);
  await assert.rejects(changeIndustryMaster(bytes, { type: "add", industryCode: "6", industryName: " " }), /業種名/);
  await assert.rejects(changeIndustryMaster(bytes, { type: "add", industryCode: "1", industryName: "追加" }), /同じ業種コード/);
  await assert.rejects(changeIndustryMaster(bytes, { type: "add", industryCode: "10", industryName: "直営自動車" }), /同じ業種名/);
  changed = await changeIndustryMaster(changed, { type: "update", id: 1, industryCode: "01", industryName: "業種改定" });
  assert.equal((await readPlanContents(changed)).industries.find(item => item.id === 1).industryName, "業種改定");
  changed = await changeIndustryMaster(changed, { type: "delete", id: 2 });
  assert.ok(!(await readPlanContents(changed)).industries.some(item => item.id === 2));
  await assert.rejects(changeIndustryMaster(changed, { type: "delete", id: 999 }), /見つかりません/);
  assert.deepEqual((await readPlanContents(bytes)).industries, initial);
  await validateTriadicDatabase(changed);

  let empty = bytes;
  for (const item of initial) empty = await changeIndustryMaster(empty, { type: "delete", id: item.id });
  assert.deepEqual((await readPlanContents(empty)).industries, [], "全件削除しても初期データを復活させない");
  const otherChange = await changeAccountMaster(empty, { type: "add", accountCode: "001", accountName: "別マスタ更新", accountType: "expense" });
  assert.deepEqual((await readPlanContents(otherChange.bytes)).industries, []);
  const malformed = await openTriadicDatabase(bytes);
  malformed.exec("DROP TABLE industries");
  const malformedBytes = malformed.export(); malformed.close();
  await assert.rejects(validateTriadicDatabase(malformedBytes));

  const populated = await changeAccountMaster(bytes, { type: "add", accountCode: "001", accountName: "移行確認", accountType: "expense" });
  const legacyDb = await openTriadicDatabase(await api.asLegacyTestPlan(populated.bytes));
  legacyDb.run("UPDATE expansions SET name = ? WHERE id = 1", ["移行前の展開名"]);
  legacyDb.exec("ALTER TABLE aggregation_groups DROP COLUMN display_name; DROP TABLE industries; PRAGMA user_version = 4; UPDATE triadic_metadata SET value = '4' WHERE key = 'format_version';");
  const legacy = legacyDb.export(); legacyDb.close();
  assert.deepEqual((await readPlanContents(legacy)).industries, initial);
  const migrated = await changeIndustryMaster(legacy, { type: "update", id: 8, industryCode: "8", industryName: "管理費改定" });
  assert.equal((await readPlanContents(migrated)).accounts[0].accountName, "移行確認");
  assert.equal((await readPlanContents(migrated)).industries.find(item => item.id === 8).industryName, "管理費改定");
  assert.equal((await readPlanContents(migrated)).expansions.find(item => item.id === 1).expansionName, "移行前の展開名");
  const untouched = await openTriadicDatabase(legacy);
  assert.equal(untouched.exec("PRAGMA user_version")[0].values[0][0], 4); untouched.close();

  const accountPlan = await changeAccountMaster(bytes, { type: "add", accountCode: "002", accountName: "業種選択確認", accountType: "sales" });
  const contents = await readPlanContents(accountPlan.bytes);
  const draft = { name: "業種選択施策", note: "", fiscalYear: "2026", expansionId: contents.expansions[0].id, industryId: 1, rows: [{ accountId: contents.accounts[0].id, amounts: { 4: "1.001" } }] };
  let assigned = await api.registerInitiative(accountPlan.bytes, draft);
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 1);
  await assert.rejects(api.registerInitiative(accountPlan.bytes, { ...draft, industryId: 999 }), /業種名/);
  await assert.rejects(changeIndustryMaster(assigned, { type: "delete", id: 1 }), /使用/);
  assigned = await changeIndustryMaster(assigned, { type: "update", id: 1, industryCode: "01", industryName: "参照保持" });
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 1);
  const beforeUpdate = (await readPlanContents(assigned)).initiatives[0];
  assigned = await api.updateInitiative(assigned, beforeUpdate.id, 2026, { ...draft, industryId: 2 });
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 2);
  assert.deepEqual((await readPlanContents(assigned)).initiatives[0].months, beforeUpdate.months);
  assigned = await api.updateInitiative(assigned, beforeUpdate.id, 2026, { ...draft, industryId: null });
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, null);
  assigned = await changeIndustryMaster(assigned, { type: "delete", id: 2 });
  const v10 = await openTriadicDatabase(assigned);
  v10.exec("DROP TABLE kind_types; DROP INDEX initiatives_industry_idx; ALTER TABLE initiatives DROP COLUMN industry_id; PRAGMA user_version = 10; UPDATE triadic_metadata SET value = '10' WHERE key = 'format_version';");
  const oldBytes = v10.export(); v10.close();
  assert.equal((await readPlanContents(oldBytes)).initiatives[0].industryId, null);
  const migratedIndustry = await api.updateInitiative(oldBytes, beforeUpdate.id, 2026, { ...draft, industryId: 1 });
  assert.equal((await readPlanContents(migratedIndustry)).initiatives[0].industryId, 1);
  const untouchedV10 = await openTriadicDatabase(oldBytes);
  assert.equal(untouchedV10.exec("PRAGMA user_version")[0].values[0][0], 10); untouchedV10.close();

  let stored = bytes;
  let writes = 0;
  const handle = { name: "industry.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() {
    let pending;
    return { async write(value) { pending = value; writes++; }, async close() { stored = new Uint8Array(pending); }, async abort() {} };
  } };
  const plan = { ...await readPlanContents(bytes), bytes, handle, name: handle.name };
  const noPicker = () => { throw new Error("不要な保存先選択"); };
  const add = { type: "add", industryCode: "10", industryName: "保存確認" };
  const saved = await saveIndustryMaster(plan, add, noPicker);
  assert.deepEqual((await readPlanContents(stored)).industries, saved.industries);
  await assert.rejects(saveIndustryMaster(plan, { ...add, industryCode: "11" }, noPicker), /別の操作で更新/);
  assert.equal(writes, 1);
  const before = stored.slice();
  const fail = { ...handle, async createWritable() { return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} }; } };
  await assert.rejects(saveIndustryMaster({ ...saved, handle: fail }, { type: "delete", id: 1 }, noPicker), /保存失敗/);
  assert.deepEqual(stored, before);
  await assert.rejects(saveIndustryMaster({ ...plan, handle: undefined }, add, async () => { throw new DOMException("キャンセル", "AbortError"); }), { name: "AbortError" });
  assert.deepEqual((await readPlanContents(bytes)).industries, initial);
  console.log("PASS: industry defaults, CRUD, validation, legacy migration, persistence and failed/cancelled/conflicting saves");
}
