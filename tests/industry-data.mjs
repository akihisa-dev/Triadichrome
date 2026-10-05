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

  const accountPlan = await changeAccountMaster(bytes, { type: "add", accountCode: "002", accountName: "業種選択確認", accountType: "sales" });
  const contents = await readPlanContents(accountPlan.bytes);
  const draft = { name: "業種選択施策", note: "", fiscalYear: "2026", expansionId: contents.expansions[0].id, industryId: 1, departmentId: contents.departments[0].id, rows: [{ accountId: contents.accounts[0].id, amounts: { 4: "1.001" } }] };
  let assigned = await api.registerInitiative(accountPlan.bytes, draft);
  draft.rows[0].id = (await readPlanContents(assigned)).initiatives[0].rows[0].id;
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 1);
  await assert.rejects(api.registerInitiative(accountPlan.bytes, { ...draft, industryId: 999 }), /業種名/);
  await assert.rejects(changeIndustryMaster(assigned, { type: "delete", id: 1 }), /使用/);
  assigned = await changeIndustryMaster(assigned, { type: "update", id: 1, industryCode: "01", industryName: "参照保持" });
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 1);
  const beforeUpdate = (await readPlanContents(assigned)).initiatives[0];
  assigned = await api.updateInitiative(assigned, beforeUpdate.id, 2026, { ...draft, industryId: 2 });
  assert.equal((await readPlanContents(assigned)).initiatives[0].industryId, 2);
  assert.deepEqual((await readPlanContents(assigned)).initiatives[0].months, beforeUpdate.months);
  await assert.rejects(api.updateInitiative(assigned, beforeUpdate.id, 2026, { ...draft, industryId: null }), /業種名/);

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
  console.log("PASS: industry defaults, CRUD, validation, persistence and failed/cancelled/conflicting saves");
}
