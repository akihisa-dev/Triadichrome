import assert from "node:assert/strict";

export async function verifyExpansionData(api) {
  const { createTriadicDatabase, readPlanContents, changeExpansionMaster, saveExpansionMaster, openTriadicDatabase, changeAccountMaster, validateTriadicDatabase } = api;
  const bytes = await createTriadicDatabase();
  const initial = (await readPlanContents(bytes)).expansions;
  assert.deepEqual(initial.map(item => [item.expansionCode, item.expansionName]), [
    ["1", "コスト"], ["2", "料改"], ["3", "撤退"], ["4", "物量"], ["5", "拡販"], ["8", "効率"], ["9", "移管"],
  ]);
  let changed = await changeExpansionMaster(bytes, { type: "add", expansionCode: "010", expansionName: "追加確認" });
  assert.equal((await readPlanContents(changed)).expansions.at(-1).expansionCode, "010");
  for (const code of ["", "１", "-1", "1.2", "a"]) await assert.rejects(changeExpansionMaster(bytes, { type: "add", expansionCode: code, expansionName: "無効" }), /半角数字/);
  await assert.rejects(changeExpansionMaster(bytes, { type: "add", expansionCode: "6", expansionName: " " }), /展開名/);
  await assert.rejects(changeExpansionMaster(bytes, { type: "add", expansionCode: "1", expansionName: "追加" }), /同じ展開コード/);
  await assert.rejects(changeExpansionMaster(bytes, { type: "add", expansionCode: "6", expansionName: "コスト" }), /同じ展開名/);
  changed = await changeExpansionMaster(changed, { type: "update", id: 1, expansionCode: "01", expansionName: "コスト改定" });
  assert.equal((await readPlanContents(changed)).expansions.find(item => item.id === 1).expansionName, "コスト改定");
  changed = await changeExpansionMaster(changed, { type: "delete", id: 2 });
  assert.ok(!(await readPlanContents(changed)).expansions.some(item => item.id === 2));
  await assert.rejects(changeExpansionMaster(changed, { type: "delete", id: 999 }), /見つかりません/);
  assert.deepEqual((await readPlanContents(bytes)).expansions, initial);
  await validateTriadicDatabase(changed);

  let empty = bytes;
  for (const item of initial) empty = await changeExpansionMaster(empty, { type: "delete", id: item.id });
  assert.deepEqual((await readPlanContents(empty)).expansions, [], "全件削除しても初期データを復活させない");
  const otherChange = await changeAccountMaster(empty, { type: "add", accountCode: "001", accountName: "別マスタ更新", accountType: "expense" });
  assert.deepEqual((await readPlanContents(otherChange.bytes)).expansions, []);
  const malformed = await openTriadicDatabase(bytes);
  malformed.exec("DROP TABLE expansions");
  const malformedBytes = malformed.export(); malformed.close();
  await assert.rejects(validateTriadicDatabase(malformedBytes));

  let stored = bytes;
  let writes = 0;
  const handle = { name: "expansion.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() {
    let pending;
    return { async write(value) { pending = value; writes++; }, async close() { stored = new Uint8Array(pending); }, async abort() {} };
  } };
  const plan = { ...await readPlanContents(bytes), bytes, handle, name: handle.name };
  const noPicker = () => { throw new Error("不要な保存先選択"); };
  const add = { type: "add", expansionCode: "6", expansionName: "保存確認" };
  const saved = await saveExpansionMaster(plan, add, noPicker);
  assert.deepEqual((await readPlanContents(stored)).expansions, saved.expansions);
  await assert.rejects(saveExpansionMaster(plan, { ...add, expansionCode: "7" }, noPicker), /別の操作で更新/);
  assert.equal(writes, 1);
  const before = stored.slice();
  const fail = { ...handle, async createWritable() { return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} }; } };
  await assert.rejects(saveExpansionMaster({ ...saved, handle: fail }, { type: "delete", id: 1 }, noPicker), /保存失敗/);
  assert.deepEqual(stored, before);
  await assert.rejects(saveExpansionMaster({ ...plan, handle: undefined }, add, async () => { throw new DOMException("キャンセル", "AbortError"); }), { name: "AbortError" });
  assert.deepEqual((await readPlanContents(bytes)).expansions, initial);
  console.log("PASS: expansion defaults, CRUD, validation, persistence and failed/cancelled/conflicting saves");
}
