import assert from "node:assert/strict";

export async function verifyDataHistory(api) {
  const { createTriadicDatabase, readPlanContents, openTriadicDatabase, readDataHistory, readHistorySnapshot, trackHistoryChange,
    recordDataHistory, restoreDataHistory, deleteDataHistory, writePlanChange, saveKindSelection, registerInitiative,
    savePreviousAmounts, changeAccountMaster, changeDepartmentMaster } = api;
  const t = minutes => new Date(Date.UTC(2026, 3, 1, 0, minutes)).toISOString();
  const original = await createTriadicDatabase(2026);
  const expected = await readPlanContents(original);
  assert.deepEqual(await readDataHistory(original), { entries: [], dirtySince: null });
  assert.equal(await recordDataHistory(original, t(10), true), original, "閲覧だけでは履歴を作らない");

  let bytes = await trackHistoryChange(original, await saveKindSelection(original, "cost-table", [1, 2]), t(0));
  let history = await readDataHistory(bytes);
  assert.equal(history.entries.length, 1, "初回変更前を記録");
  assert.deepEqual(await api.readSnapshotContents(await readHistorySnapshot(bytes, history.entries[0].id)), expected);
  const draft = { name: "履歴の確認", note: "初期", expansionId: 1, industryId: 1, departmentId: 1, fiscalYear: "2026",
    rows: [{ accountId: expected.accounts[0].id, amounts: { 4: "0.001", 3: "-2.345" }, overrides: { 2: { 4: "9", 10: "0" } } }] };
  bytes = await trackHistoryChange(bytes, await registerInitiative(bytes, draft), t(2));
  assert.equal((await readDataHistory(bytes)).dirtySince, t(0), "追加保存でも最初の5分期限を延長しない");
  assert.equal(await recordDataHistory(bytes, t(4)), bytes, "5分前に自動記録しない");
  bytes = await recordDataHistory(bytes, t(5));
  const fiveMinutes = await readPlanContents(bytes);
  assert.equal((await readDataHistory(bytes)).dirtySince, null);
  assert.equal((await readDataHistory(bytes)).entries.length, 2);
  assert.equal(await recordDataHistory(bytes, t(15)), bytes, "変更のない期間に履歴を増やさない");

  bytes = await trackHistoryChange(bytes, await savePreviousAmounts(bytes, { industryId: 1, departmentId: 1,
    rows: [{ accountId: expected.accounts[0].id, amounts: { 4: "123.456" } }] }), t(16));
  const department = await changeDepartmentMaster(bytes, { type: "update", id: 1, departmentName: "変更後の部署" });
  bytes = await trackHistoryChange(bytes, department, t(17));
  const account = await changeAccountMaster(bytes, { type: "update", id: expected.accounts[0].id,
    accountCode: "001", accountName: "変更後の科目", accountType: expected.accounts[0].accountType });
  bytes = await trackHistoryChange(bytes, account.bytes, t(18));
  const latest = await readPlanContents(bytes);
  assert.notDeepEqual(latest, fiveMinutes);
  bytes = await recordDataHistory(bytes, t(19), true);
  history = await readDataHistory(bytes);
  assert.equal(history.entries.length, 3, "終了・閲覧前には5分未満でも記録");
  for (const entry of history.entries) {
    const snapshot = await readHistorySnapshot(bytes, entry.id);
    await assert.rejects(openTriadicDatabase(snapshot), /形式|読み込/, "履歴内の計画を通常ファイルとして開かない");
    const snapshotDb = await api.openBusinessSnapshot(snapshot);
    assert.equal(snapshotDb.exec("SELECT name FROM sqlite_master WHERE name LIKE 'data_history%'").length, 0, "履歴を入れ子にしない"); snapshotDb.close();
    assert.ok(snapshot.length < bytes.length, "過去の履歴全体を各記録に複製しない");
  }
  const olderId = history.entries[1].id;
  const restored = await restoreDataHistory(bytes, olderId, t(20));
  assert.deepEqual(await readPlanContents(restored), fiveMinutes, "金額・手修正・前年・マスタ・設定を全体復元");
  const restoredHistory = await readDataHistory(restored);
  assert.equal(restoredHistory.entries.length, 5);
  assert.ok(history.entries.every(entry => restoredHistory.entries.some(item => item.id === entry.id)), "新しい履歴も保持");
  const reverted = await restoreDataHistory(restored, restoredHistory.entries[1].id, t(21));
  assert.deepEqual(await readPlanContents(reverted), latest, "復元前へ戻せる");

  const deleted = await deleteDataHistory(restored, { ids: [history.entries[0].id, olderId] });
  assert.deepEqual(await readPlanContents(deleted), fiveMinutes, "削除で現在のデータを変えない");
  await assert.rejects(readHistorySnapshot(deleted, olderId), /見つかりません/);
  const cutoff = await deleteDataHistory(restored, { before: t(5) });
  const cutoffEntries = (await readDataHistory(cutoff)).entries;
  assert.equal(cutoffEntries.length, 4, "指定日時と同時刻は削除しない");
  assert.ok(cutoffEntries.some(entry => entry.recordedAt === t(5)));
  const allDeleted = await deleteDataHistory(restored, { ids: restoredHistory.entries.map(entry => entry.id) });
  assert.equal((await readDataHistory(allDeleted)).entries.length, 0);
  const next = await recordDataHistory(await trackHistoryChange(allDeleted, await saveKindSelection(allDeleted, "cost-table", [2]), t(22)), t(23), true);
  assert.ok((await readDataHistory(next)).entries[0].id > restoredHistory.entries[0].id, "削除後も識別子を再利用しない");
  await assert.rejects(deleteDataHistory(restored, { before: "invalid" }), /日時/);
  await assert.rejects(deleteDataHistory(restored, { ids: [olderId, 99999] }), /見つかりません/);
  await assert.rejects(readHistorySnapshot(restored, -1), /選択/);

  const invalid = await openTriadicDatabase(restored);
  invalid.run("UPDATE data_history SET recorded_at = 'invalid' WHERE id = ?", [olderId]);
  const invalidBytes = invalid.export(); invalid.close();
  await assert.rejects(openTriadicDatabase(invalidBytes), /読み込|形式/);
  const corrupt = await openTriadicDatabase(restored);
  const corruptBlob = new Uint8Array(200); corruptBlob.set(new TextEncoder().encode("SQLite format 3\u0000"));
  corrupt.run("UPDATE data_history SET snapshot = ? WHERE id = ?", [corruptBlob, olderId]);
  const corruptBytes = corrupt.export(); corrupt.close();
  await assert.rejects(restoreDataHistory(corruptBytes, olderId), /読み込|形式/);
  const nested = await openTriadicDatabase(restored);
  nested.run("UPDATE data_history SET snapshot = ? WHERE id = ?", [restored, olderId]);
  const nestedBytes = nested.export(); nested.close();
  await assert.rejects(readHistorySnapshot(nestedBytes, olderId), /中に履歴/);
  const otherYear = await api.createBusinessSnapshot(await createTriadicDatabase(2025));
  const mismatch = await openTriadicDatabase(restored);
  mismatch.run("UPDATE data_history SET snapshot = ? WHERE id = ?", [otherYear, olderId]);
  const mismatchBytes = mismatch.export(); mismatch.close();
  await assert.rejects(restoreDataHistory(mismatchBytes, olderId), /基準年度/);

  let stored = bytes;
  let fail = "";
  let aborted = false;
  const handle = { name: "履歴確認.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() {
    let pending;
    return { async write(value) { pending = value; if (fail === "write") throw new Error("書込失敗"); },
      async close() { if (fail === "close") throw new Error("確定失敗"); stored = new Uint8Array(pending); }, async abort() { aborted = true; } };
  } };
  const plan = { ...latest, bytes, name: handle.name, handle };
  for (const candidate of [restored, deleted]) {
    for (const stage of ["write", "close"]) {
      fail = stage; aborted = false;
      await assert.rejects(writePlanChange(plan, handle, candidate, { historyPrepared: true }), /失敗/);
      assert.equal(aborted, true);
      assert.deepEqual(stored, bytes, "履歴の保存失敗でも現在と過去を保護");
    }
  }
  fail = "";
  const saved = await writePlanChange(plan, handle, restored, { historyPrepared: true });
  assert.deepEqual(saved.bytes, stored);
  assert.deepEqual(await readPlanContents(stored), fiveMinutes, "復元成功は実ファイル境界で確定");
  await assert.rejects(writePlanChange(plan, handle, deleted, { historyPrepared: true }), /別の操作で更新/);
  assert.deepEqual(stored, restored);
  console.log("PASS: データ時点履歴の記録期限、入れ子防止、全体復元、復元取消、削除、破損拒否、失敗・競合時の保護");
}
