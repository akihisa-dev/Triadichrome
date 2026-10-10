import assert from "node:assert/strict";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
export async function verifyPlanSession(api) {
  await verifyHistoryTimer(api);
  const bytes = await api.createTriadicDatabase(2026);
  const contents = await api.readPlanContents(bytes);
  const noPicker = async () => { throw new Error("自動保存で保存先を尋ねない"); };
  function file(initial = bytes) {
    let stored = initial.slice(), fail = false, writes = 0;
    const handle = { name: "session.triadic", async getFile() { return new File([stored], this.name); },
      async queryPermission() { return "granted"; }, async requestPermission() { return "granted"; },
      async createWritable() { let pending; return {
        async write(value) { pending = new Uint8Array(value).slice(); }, async close() { if (fail) throw new Error("確定失敗"); stored = pending; writes++; }, async abort() {},
      }; },
    };
    return { handle, get bytes() { return stored; }, get writes() { return writes; }, fail(value) { fail = value; }, replace(value) { stored = value; } };
  }
  const original = { ...contents, bytes, name: "drop.triadic" };
  const session = new api.PlanSession();
  await session.open(original);
  assert.equal("bytes" in session.getSnapshot().contents, false);
  assert.equal("handle" in session.getSnapshot().contents, false);
  const destination = file(new Uint8Array());
  const choose = deferred();
  let pickers = 0;
  const first = session.dispatch({ type: "department", change: { type: "add", departmentName: "追加部署", industryIds: [1] } }, () => { pickers++; return choose.promise; });
  assert.equal(session.getSnapshot().busy, true, "選択待ち中もキューを予約する");
  choose.resolve(destination.handle); await first;
  assert.equal(pickers, 1);
  assert.ok(session.getSnapshot().contents.departments.some(item => item.departmentName === "追加部署"));
  const beforeSelection = session.getSnapshot().contents;
  const fullRead = api.processingTasks.readPlanContents;
  api.processingTasks.readPlanContents = async () => { throw new Error("表示設定だけの変更で全計画を読み直さない"); };
  const one = session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1, 2] } }, noPicker);
  const two = session.dispatch({ type: "settings", change: { type: "selection", screen: "initiative-list", selected: [1] } }, noPicker);
  try { await Promise.all([one, two]); }
  finally { api.processingTasks.readPlanContents = fullRead; }
  for (const key of ["accounts", "aggregations", "initiatives", "previousAmounts", "kinds", "details"]) {
    assert.equal(session.getSnapshot().contents[key], beforeSelection[key], "表示設定以外の計算元を再利用する");
  }
  for (const [screen, selected] of [["cost-table", []], ["cost-table", [1, 1]], ["initiative-list", [1, 2]], ["missing", [1]]]) {
    await assert.rejects(api.processingTasks.prepareKindSelectionSave(destination.bytes, screen, selected), /正しくありません/);
  }
  assert.deepEqual((await api.readPlanContents(destination.bytes)).kindSelections, session.getSnapshot().contents.kindSelections);
  assert.deepEqual(session.getSnapshot().contents.kindSelections["cost-table"], [1, 2]);
  assert.deepEqual(session.getSnapshot().contents.kindSelections["initiative-list"], [1]);
  const prior = session.getSnapshot().contents;
  const priorBytes = destination.bytes.slice();
  destination.fail(true);
  await assert.rejects(session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } }, noPicker), /確定失敗/);
  assert.equal(session.getSnapshot().contents, prior);
  assert.deepEqual(destination.bytes, priorBytes);
  destination.fail(false);
  await session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } }, noPicker);
  const readHistory = api.processingTasks.readDataHistory;
  const closeWritable = destination.handle.createWritable;
  destination.handle.createWritable = async () => {
    const writable = await closeWritable();
    const close = writable.close;
    writable.close = async () => {
      await close();
      api.processingTasks.readDataHistory = async () => { throw new Error("確定後の読み取り障害"); };
    };
    return writable;
  };
  try {
    await session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1] } }, noPicker);
    assert.deepEqual(session.getSnapshot().contents.kindSelections["cost-table"], [1]);
    assert.equal(session.getSnapshot().canUndo, true);
    assert.equal("savedHistory" in session.getSnapshot().contents, false);
  } finally {
    api.processingTasks.readDataHistory = readHistory;
    destination.handle.createWritable = closeWritable;
  }
  assert.deepEqual((await api.readPlanContents(destination.bytes)).kindSelections, session.getSnapshot().contents.kindSelections);
  await session.travelOperation(-1, noPicker);
  await session.travelOperation(1, noPicker);
  const permission = deferred();
  destination.handle.requestPermission = () => permission.promise;
  const prepared = session.prepareSave(noPicker);
  assert.equal(session.getSnapshot().busy, true);
  const checkpoint = session.checkpoint(true, noPicker);
  permission.resolve("granted"); await Promise.all([prepared, checkpoint]);
  assert.equal(session.getSnapshot().history.dirtySince, null);
  const beforePreview = session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } }, noPicker);
  const preview = session.preview(session.getSnapshot().history.entries[0].id, noPicker);
  await Promise.all([beforePreview, preview]);
  assert.equal(session.getSnapshot().history.dirtySince, null, "直前の保存も閲覧前に履歴へ記録する");
  const writes = destination.writes;
  await session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1] } }, noPicker);
  assert.equal(destination.writes, writes + 1, "許可準備後も最新の保存byteを使用する");
  const update = session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1, 2] } }, noPicker);
  const close = session.close(noPicker);
  await Promise.all([update, close]);
  assert.equal(session.getSnapshot().contents, null);
  assert.equal((await api.readDataHistory(destination.bytes)).dirtySince, null, "直前の保存も終了前に履歴へ記録する");
  await session.open({ ...await api.readPlanContents(destination.bytes), bytes: destination.bytes, handle: destination.handle, name: destination.handle.name });
  destination.replace(await api.saveKindSelection(destination.bytes, "cost-table", [2]));
  const beforeConflict = session.getSnapshot().contents;
  await assert.rejects(session.dispatch({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [1] } }, noPicker), /別の操作で更新/);
  assert.equal(session.getSnapshot().contents, beforeConflict);
  const retry = new api.PlanSession();
  await retry.open(original);
  const failedDestination = file(new Uint8Array()); failedDestination.fail(true);
  const command = { type: "department", change: { type: "add", departmentName: "再試行部署", industryIds: [1] } };
  await assert.rejects(retry.dispatch(command, async () => failedDestination.handle), /確定失敗/);
  assert.equal(retry.getHandle(), undefined);
  failedDestination.fail(false);
  await retry.dispatch(command, async () => failedDestination.handle);
  assert.equal(retry.getSnapshot().contents.departments.filter(item => item.departmentName === "再試行部署").length, 1);
  console.log("PASS: 保存担当の直列実行、保存先選択・許可待ち、確定失敗・再試行、外部競合、終了前の履歴記録");
}

async function verifyHistoryTimer(api) {
  const initial = await api.createTriadicDatabase(2026);
  let now = Date.parse("2026-04-01T00:00:00Z");
  const first = new Date(now).toISOString();
  let bytes = await api.trackHistoryChange(initial, await api.saveKindSelection(initial, "cost-table", [2]), first);
  let snapshot = { contents: await api.readPlanContents(bytes), busy: false, historyError: "", history: await api.readDataHistory(bytes) };
  let timer, calls = 0, fail = false;
  const clock = { now: () => now, setTimeout(callback, delay) { timer = { callback, delay }; return timer; }, clearTimeout() { timer = null; } };
  const session = { getSnapshot: () => snapshot, async checkpoint() {
    calls++;
    if (fail) { snapshot.historyError = "失敗"; throw new Error("失敗"); }
    bytes = await api.recordDataHistory(bytes, new Date(now).toISOString(), false);
    snapshot.history = await api.readDataHistory(bytes);
  } };
  const tick = async () => { const pending = timer; timer = null; pending.callback();
    while (!timer && snapshot.history.dirtySince && !snapshot.historyError) await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  const stop = api.scheduleHistoryCheckpoint(session, async () => {}, clock);
  assert.equal(timer.delay, 300000);
  now -= 60000; await tick();
  assert.equal(calls, 1); assert.equal(timer.delay, 360000, "時計後退で期限前に正常終了しても再予約する");
  bytes = await api.trackHistoryChange(bytes, await api.saveKindSelection(bytes, "initiative-list", [1]), new Date(now).toISOString());
  snapshot.history = await api.readDataHistory(bytes);
  assert.equal(snapshot.history.dirtySince, first, "追加保存で期限を延ばさない");
  snapshot.busy = true; now += 360000; await tick(); assert.equal(timer.delay, 250);
  snapshot.busy = false; await tick();
  assert.equal(calls, 2); assert.equal(snapshot.history.dirtySince, null);
  assert.equal(snapshot.history.entries.length, 2); assert.equal(timer, null, "記録後に重複予約しない");
  stop();
  bytes = await api.trackHistoryChange(bytes, await api.saveKindSelection(bytes, "initiative-list", [2]), new Date(now).toISOString());
  snapshot.history = await api.readDataHistory(bytes);
  fail = true;
  const stopFailure = api.scheduleHistoryCheckpoint(session, async () => {}, clock);
  now += 300000; await tick(); assert.equal(timer, null, "失敗時は再試行の操作を待つ");
  stopFailure();
  snapshot.historyError = "";
  const stopClosed = api.scheduleHistoryCheckpoint(session, async () => {}, clock);
  const pending = timer; stopClosed(); pending.callback();
  assert.equal(timer, null, "終了後は予約から処理を再開しない");
}
