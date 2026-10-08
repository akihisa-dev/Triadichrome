import assert from "node:assert/strict";

export async function verifySavedOperations(api) {
  let bytes = await api.createTriadicDatabase(2026);
  let fail = false, permission = "granted", pause;
  const handle = {
    name: "operations.triadic",
    async getFile() { return new File([bytes], this.name); },
    async queryPermission() { return permission; },
    async createWritable() {
      let pending;
      return {
        async write(value) { pending = new Uint8Array(value).slice(); if (pause) await pause; },
        async close() { if (fail) throw new Error("保存失敗"); bytes = pending; },
        async abort() {},
      };
    },
  };
  const noPicker = async () => { throw new Error("保存先を尋ねない"); };
  const session = new api.PlanSession();
  const contents = () => session.getSnapshot().contents;
  const open = async () => session.open({ ...await api.readPlanContents(bytes), bytes, name: handle.name, handle });
  const save = command => session.dispatch(command, noPicker);
  const travel = direction => session.travelOperation(direction, noPicker);
  const snapshots = [];
  await open();
  snapshots.push(contents());
  assert.equal(session.getSnapshot().canUndo, false);
  await assert.rejects(travel(-1), /取り消せる操作/);
  const add = async command => { await save(command); snapshots.push(contents()); };
  await add({ type: "account", change: { type: "add", accountCode: "001", accountName: "操作用科目", accountType: "expense" } });
  const accountId = contents().accounts.find(item => item.accountCode === "001").id;
  await add({ type: "account", change: { type: "reorder", ids: [accountId, ...contents().accounts.filter(item => item.id !== accountId).map(item => item.id)] } });
  await add({ type: "aggregation", change: { type: "add", name: "操作用集計" } });
  const group = contents().aggregations.find(item => item.name === "操作用集計");
  await add({ type: "aggregation", change: { type: "move", member: { kind: "account", id: accountId }, parentId: group.id, sign: -1 } });
  await add({ type: "department", change: { type: "add", departmentName: "操作用部署" } });
  await add({ type: "department", change: { type: "delete", id: contents().departments.find(item => item.departmentName === "操作用部署").id } });
  await add({ type: "expansion", change: { type: "update", ...contents().expansions[0], expansionName: "編集済み展開" } });
  await add({ type: "industry", change: { type: "update", ...contents().industries[0], industryName: "編集済み業種" } });
  await add({ type: "period", change: { type: "update", ...contents().periodTypes[0], periodName: "編集済み期間" } });
  await add({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } });
  await add({ type: "settings", change: { type: "previous", input: { industryId: 1, departmentId: 1, rows: [{ accountId, amounts: { 4: "0.001", 5: "-1.251" } }] } } });
  await add({ type: "initiative.register", draft: { name: "操作用施策", note: "登録時", fiscalYear: "2026", expansionId: 1, industryId: 1, departmentId: 1, periodTypeId: 1,
    rows: [{ id: "operation-row", accountId, amounts: { 4: "120.125", 5: "-0.001" }, overrides: { 2: { 4: "0" } } }] } });
  const initiative = contents().initiatives[0];
  await add({ type: "initiative.update", id: initiative.id, draft: { ...initiative, fiscalYear: "2026", note: "更新後", rows: initiative.rows.map(row => ({ ...row, amounts: { ...row.amounts, 4: "130.001" } })) } });
  const confirmed = contents().initiatives[0];
  await add({ type: "initiative.update", id: confirmed.id, draft: { ...confirmed, fiscalYear: "2026", rows: confirmed.rows.map(row => ({ ...row, overrides: { 2: { ...row.overrides[2], 5: "-2.001" } } })) } });
  await session.checkpoint(true, noPicker);
  const ids = session.getSnapshot().history.entries.map(item => item.id);
  await session.deleteHistory({ ids: [ids.at(-1)] }, noPicker);
  const remainingHistory = session.getSnapshot().history.entries;
  for (let index = snapshots.length - 2; index >= 0; index--) {
    await travel(-1);
    assert.deepEqual(contents(), snapshots[index], "登録・分類・行識別子・手修正・前年・並び・所属を一つ前の保存状態へ戻す");
    assert.deepEqual(await api.readPlanContents(bytes), snapshots[index], "取り消しをファイルへ保存する");
    assert.deepEqual(session.getSnapshot().history.entries, remainingHistory, "後から記録した履歴は残し、削除済みの履歴は復活させない");
  }
  assert.equal(session.getSnapshot().canUndo, false);
  for (let index = 1; index < snapshots.length; index++) {
    await travel(1);
    assert.deepEqual(contents(), snapshots[index], "全操作を元の識別子と精度でやり直す");
  }
  assert.equal(session.getSnapshot().canRedo, false);

  await travel(-1);
  const beforeFailure = session.getSnapshot();
  const beforeBytes = bytes.slice();
  fail = true;
  await assert.rejects(travel(1), /保存失敗/);
  await assert.rejects(save({ type: "department", change: { type: "add", departmentName: "失敗用部署" } }), /保存失敗/);
  assert.equal(contents(), beforeFailure.contents);
  assert.deepEqual(bytes, beforeBytes);
  assert.equal(session.getSnapshot().operationRevision, beforeFailure.operationRevision);
  assert.equal(session.getSnapshot().canRedo, true);
  fail = false;
  permission = "denied";
  await assert.rejects(travel(1), /保存を再試行/);
  assert.equal(contents(), beforeFailure.contents);
  permission = "granted";
  await save({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [2] } });
  assert.equal(session.getSnapshot().canRedo, true, "同じ表示設定の保存は新しい操作にしない");
  const unchanged = contents().initiatives[0];
  await save({ type: "initiative.update", id: unchanged.id, draft: { ...unchanged, fiscalYear: "2026" } });
  assert.equal(session.getSnapshot().canRedo, true, "更新番号だけ増える保存も新しい操作にしない");
  await travel(1);

  let release;
  pause = new Promise(resolve => { release = resolve; });
  const inFlight = travel(-1);
  await assert.rejects(travel(-1), /保存が終わる/);
  release(); await inFlight; pause = undefined;
  await save({ type: "department", change: { type: "add", departmentName: "新しい操作" } });
  assert.equal(session.getSnapshot().canRedo, false, "取り消し後の新しい保存でやり直しを破棄する");

  const external = await api.saveKindSelection(bytes, "cost-table", [1]);
  const beforeConflict = contents();
  bytes = external;
  await assert.rejects(travel(-1), /別の操作で更新/);
  assert.equal(contents(), beforeConflict);
  assert.deepEqual(bytes, external);
  await open();
  assert.equal(session.getSnapshot().canUndo, false);
  assert.equal(session.getSnapshot().canRedo, false);
  await assert.rejects(api.applyOperationSnapshot(bytes, await api.createBusinessSnapshot(await api.createTriadicDatabase(2025))), /基準年度/);

  for (let index = 0; index < api.OPERATION_HISTORY_LIMIT + 1; index++) {
    await save({ type: "settings", change: { type: "selection", screen: "cost-table", selected: [index % 2 ? 1 : 2] } });
  }
  for (let index = 0; index < api.OPERATION_HISTORY_LIMIT; index++) await travel(-1);
  assert.equal(session.getSnapshot().canUndo, false, "直近100操作まで保持する");
  assert.deepEqual(contents().kindSelections["cost-table"], [2], "最古の保持対象より前の変更は戻さない");
  await travel(1);
  fail = true;
  await assert.rejects(session.restore(remainingHistory[0].id, noPicker), /保存失敗/);
  assert.equal(session.getSnapshot().canUndo, true, "時点復元失敗で操作履歴を消さない");
  fail = false;
  await session.restore(remainingHistory[0].id, noPicker);
  assert.equal(session.getSnapshot().canUndo, false, "時点復元成功で操作履歴を初期化する");
  assert.equal(session.getSnapshot().canRedo, false);
  await save({ type: "department", change: { type: "add", departmentName: "終了確認" } });
  await session.close(noPicker);
  assert.equal(session.getSnapshot().canUndo, false);
  await open();
  assert.equal(session.getSnapshot().canUndo, false, "開き直しで操作履歴を再開しない");
  console.log("PASS: 保存済み全操作の取消・やり直し、100操作上限、失敗・競合保護、時点履歴維持、再開・復元時の初期化");
}
