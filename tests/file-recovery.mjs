import assert from "node:assert/strict";
export async function verifyFileRecovery(api) {
  const bytes = await api.createTriadicDatabase(2026);
  const file = (name, initial = bytes) => {
    let stored = initial, fail = false, locked = false;
    const handle = { name, async isSameEntry(other) { return other === handle; }, async getFile() { return new File([stored], name); }, async createWritable() {
      assert.equal(locked, false); locked = true; let pending;
      return { async write(data) { if (fail) throw new Error("保存失敗"); pending = new Uint8Array(data); }, async close() { stored = pending; locked = false; }, async abort() { locked = false; } };
    }};
    return { handle, get bytes() { return stored; }, replace(value) { stored = value; }, fail() { fail = true; }, get locked() { return locked; } };
  };
  const original = file("元.triadic");
  const plan = { ...await api.readPlanContents(bytes), name: original.handle.name, handle: original.handle, bytes };
  const local = await api.saveKindSelection(bytes, "cost-table", [1, 2]);
  const external = await api.saveKindSelection(bytes, "initiative-list", [1]);
  original.replace(external);
  const saved = await api.writePlanChange(plan, original.handle, local, { allowRebase: true });
  assert.deepEqual(saved.kindSelections["cost-table"], [1, 2]);
  assert.deepEqual(saved.kindSelections["initiative-list"], [1]);
  assert.ok(saved.rebasedOperation);
  await api.validateTriadicDatabase(original.bytes);
  const undo = await api.applyOperationSnapshot(saved.bytes, saved.rebasedOperation.before);
  assert.deepEqual((await api.readPlanContents(undo)).kindSelections["initiative-list"], [1], "取消で外部変更を戻さない");
  assert.deepEqual((await api.readPlanContents(undo)).kindSelections["cost-table"], [1]);
  const alreadySaved = await api.rebasePlan(bytes, local, local);
  assert.equal(alreadySaved.operation, null, "同じ変更が保存済みなら余分な取消を作らない");
  assert.deepEqual(alreadySaved.bytes, local);
  const overlap = await api.saveKindSelection(bytes, "cost-table", [2]);
  assert.equal(await api.rebasePlan(bytes, local, overlap), null);
  assert.equal(await api.rebasePlan(bytes, local, new Uint8Array([1, 2])), null);
  original.replace(overlap);
  const copy = file("入力を保持.triadic", new Uint8Array());
  let asked = 0;
  let stop = api.registerFileConflictRecovery(async name => {
    asked++; assert.equal(name, "元.triadic"); assert.equal(original.locked, false, "画面確認中は書き込みロックを保持しない"); return copy.handle;
  });
  try {
    const result = await api.writePlanChange(plan, original.handle, local, { allowRebase: true });
    assert.equal(result.handle, copy.handle);
    assert.deepEqual((await api.readPlanContents(copy.bytes)).kindSelections["cost-table"], [1, 2]);
    assert.deepEqual(original.bytes, overlap, "外部変更を上書きしない");
    assert.equal(asked, 1);
  } finally { stop(); }
  for (const destination of [null, original.handle, { name: "無効.txt" }]) {
    stop = api.registerFileConflictRecovery(async () => destination);
    try { await assert.rejects(api.writePlanChange(plan, original.handle, local), /入力は.*保持/); }
    finally { stop(); }
    assert.deepEqual(original.bytes, overlap);
  }
  const failed = file("失敗.triadic", new Uint8Array()); failed.fail();
  stop = api.registerFileConflictRecovery(async () => failed.handle);
  try { await assert.rejects(api.writePlanChange(plan, original.handle, local), /保存失敗/); }
  finally { stop(); }
  assert.deepEqual(failed.bytes, new Uint8Array());
  assert.deepEqual(original.bytes, overlap);
  const session = new api.PlanSession();
  original.replace(bytes); await session.open(plan);
  await session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1, 2] } }, async () => original.handle);
  original.replace(await api.saveKindSelection(original.bytes, "initiative-list", [1]));
  await session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } }, async () => original.handle);
  assert.equal("rebasedOperation" in session.getSnapshot().contents, false);
  await session.checkpoint(true, async () => original.handle);
  await session.checkpoint(true, async () => original.handle);
  assert.equal(session.getSnapshot().canUndo, true, "履歴記録で今回の取消を消さない");
  await session.travelOperation(-1, async () => original.handle);
  assert.deepEqual(session.getSnapshot().contents.kindSelections["initiative-list"], [1]);
  assert.deepEqual(session.getSnapshot().contents.kindSelections["cost-table"], [1, 2]);
  assert.equal(session.getSnapshot().canUndo, false, "外部変更前の全体取消は残さない");
  console.log("PASS: ファイル更新の自動統合、取消での外部変更保護、別ファイル保存、キャンセル・失敗時の入力と元ファイル保護");
}
