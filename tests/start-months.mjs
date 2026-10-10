import assert from "node:assert/strict";

export async function verifyStartMonths(api) {
  const derive = (rule, amounts, kind = 1, overrides) => api.deriveStartYearMonth(2026, rule, [{ amounts, overrides }], kind);
  assert.equal(derive("new", { 4: "0.001" }), "2026-04");
  assert.equal(derive("new", { 1: "-1" }), "2027-01");
  assert.equal(derive("new", { 7: "10", 12: "20" }), "2026-07");
  assert.equal(derive("new", {}), null);
  assert.equal(derive(null, { 4: "10" }), null);
  const gap = Object.fromEntries([4, 5, 6, 7, 8, 9].map(month => [month, "-0.001"]));
  assert.equal(derive("period_gap", gap), "2025-10");
  assert.equal(derive("period_gap", { ...gap, 10: "1", 11: "1", 12: "1" }), "2026-01");
  assert.equal(derive("period_gap", { 4: "1" }), "2025-05");
  assert.equal(derive("period_gap", {}), null);
  assert.equal(derive("period_gap", { 5: "1" }), null);
  assert.equal(derive("period_gap", { 4: "1", 6: "1" }), "2025-07", "途中の0の月も継続として扱う");
  assert.equal(derive("period_gap", { ...gap, 6: "0" }), "2025-10", "途中の欠落で境目を前へ動かさない");
  assert.equal(derive("period_gap", Object.fromEntries(api.initiativeMonths.map(month => [month, "1"]))), null, "全12か月の期間差には境目がない");
  assert.equal(api.deriveStartYearMonth(1, "period_gap", [{ amounts: { 4: "1" } }], 1), null, "暦年0を保存しない");
  assert.equal(api.deriveStartYearMonth(2026, "new", [{ amounts: { 7: "1" } }, { amounts: { 7: "-1" } }], 1), "2026-07", "相殺前の各行で判定する");
  assert.equal(derive("new", { 7: "1", 8: "1" }, 2, { 2: { 7: "0" } }), "2026-08");

  let bytes = await api.createTriadicDatabase(2026);
  const initial = await api.readPlanContents(bytes);
  const accountId = initial.accounts[0].id;
  const draft = { ...api.createInitiativeDraft("2026"), name: "開始年月確認", expansionId: initial.expansions[0].id,
    industryId: initial.industries[0].id, departmentId: initial.departments[0].id,
    periodTypeId: initial.periodTypes.find(item => item.periodName === "新規").id,
    rows: [{ accountId, amounts: { 7: "1", 8: "1" }, overrides: { 2: { 7: "0" } } }] };
  bytes = await api.registerInitiative(bytes, draft);
  let contents = await api.readPlanContents(bytes);
  const item = contents.initiatives[0];
  assert.deepEqual(item.startYearMonths, { 1: "2026-07", 2: "2026-08" });
  assert.ok(contents.details.filter(detail => detail.kindId === 1).every(detail => detail.startYearMonth === "2026-07"));
  assert.ok(contents.details.filter(detail => detail.kindId === 2).every(detail => detail.startYearMonth === "2026-08"));
  const db = await api.openTriadicDatabase(bytes);
  try {
    const columns = db.exec("PRAGMA table_info(initiatives)")[0].values.map(row => row[1]);
    assert.ok(!columns.includes("primary_start_year_month") && !columns.includes("confirmed_start_year_month"), "派生値の保存列を持たない");
    const revision = db.exec("SELECT revision FROM initiatives")[0].values[0][0];
    assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, item.startYearMonths);
    assert.equal(db.exec("SELECT revision FROM initiatives")[0].values[0][0], revision, "読み込み時の導出は保存値を更新しない");
  } finally { db.close(); }
  const snapshot = await api.createBusinessSnapshot(bytes);
  assert.deepEqual((await api.readSnapshotContents(snapshot)).initiatives[0].startYearMonths, item.startYearMonths);

  // A detail edit must refresh every detail belonging to the same kind/initiative.
  const april = contents.details.find(detail => detail.kindId === 1 && detail.month === 4);
  bytes = await api.changeDetail(bytes, { target: april, field: "amount", value: "2" });
  contents = await api.readPlanContents(bytes);
  assert.deepEqual(contents.initiatives[0].startYearMonths, { 1: "2026-04", 2: "2026-04" }, "一次の追加月は未修正の確定にも反映");
  assert.equal(contents.initiatives[0].revision, item.revision, "金額からの導出で施策の更新番号を余分に増やさない");
  await assert.rejects(api.changeDetail(bytes, { target: april, field: "amount", value: "3" }), /変更されています/);
  const confirmedApril = contents.details.find(detail => detail.kindId === 2 && detail.month === 4);
  bytes = await api.changeDetail(bytes, { target: confirmedApril, field: "amount", value: "0" });
  contents = await api.readPlanContents(bytes);
  assert.deepEqual(contents.initiatives[0].startYearMonths, { 1: "2026-04", 2: "2026-08" }, "確定の手修正0は一次の開始月を消さない");
  const restored = await api.applyOperationSnapshot(bytes, snapshot);
  assert.deepEqual((await api.readPlanContents(restored)).initiatives[0].startYearMonths, item.startYearMonths, "取り消しは2種の年月も復元");
  const cancellationDraft = { ...draft, name: "相殺する活動月", rows: [
    { accountId, amounts: { 7: "1" } }, { accountId, amounts: { 7: "-1" } },
  ] };
  const cancellation = await api.registerInitiative(restored, cancellationDraft);
  const cancelling = (await api.readPlanContents(cancellation)).initiatives.find(value => value.name === cancellationDraft.name);
  assert.deepEqual(cancelling.startYearMonths, { 1: "2026-07", 2: "2026-07" }, "保存・再読込でも相殺前の行で導出する");
  const zeroed = await api.updateInitiative(cancellation, cancelling.id, 2026, { ...cancellationDraft,
    rows: cancelling.rows.map(row => ({ ...row, amounts: {}, overrides: {} })),
  });
  assert.deepEqual((await api.readPlanContents(zeroed)).initiatives.find(value => value.id === cancelling.id).startYearMonths, { 1: null, 2: null }, "全行0化後には未確定になる");

  // Renaming a period never changes the original rule, and reused numeric IDs are not rules.
  bytes = await api.changePeriodMaster(bytes, { type: "update", id: draft.periodTypeId, periodName: "新規改名" });
  assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, { 1: "2026-04", 2: "2026-08" });
  const periodDetail = (await api.readPlanContents(bytes)).details[0];
  const gapId = initial.periodTypes.find(item => item.periodName === "期間差").id;
  bytes = await api.changeDetail(bytes, { target: periodDetail, field: "periodTypeId", value: String(gapId) });
  assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, { 1: "2025-09", 2: null }, "一次の途中の0も継続として扱う");
  contents = await api.readPlanContents(bytes);
  const current = contents.initiatives[0];
  bytes = await api.updateInitiative(bytes, current.id, 2026, { ...draft, periodTypeId: gapId,
    rows: [{ ...current.rows[0], amounts: gap, overrides: { 2: { 10: "1" } } }] });
  contents = await api.readPlanContents(bytes);
  assert.deepEqual(contents.initiatives[0].startYearMonths, { 1: "2025-10", 2: "2025-11" });
  assert.ok(contents.details.filter(detail => detail.kindId === 2).every(detail => detail.startYearMonth === "2025-11"));

  const other = await api.changePeriodMaster(bytes, { type: "add", periodName: "独自分類" });
  const otherContents = await api.readPlanContents(other);
  bytes = await api.changeDetail(other, { target: otherContents.details[0], field: "periodTypeId", value: String(otherContents.periodTypes.at(-1).id) });
  assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, { 1: null, 2: null });
  bytes = await api.changeDetail(bytes, { target: (await api.readPlanContents(bytes)).details[0], field: "periodTypeId", value: "" });
  assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, { 1: null, 2: null });
  for (const period of (await api.readPlanContents(bytes)).periodTypes) bytes = await api.changePeriodMaster(bytes, { type: "delete", id: period.id });
  bytes = await api.changePeriodMaster(bytes, { type: "add", periodName: "別の期間" });
  contents = await api.readPlanContents(bytes);
  assert.equal(contents.periodTypes[0].id, 1);
  bytes = await api.changeDetail(bytes, { target: contents.details[0], field: "periodTypeId", value: "1" });
  assert.deepEqual((await api.readPlanContents(bytes)).initiatives[0].startYearMonths, { 1: null, 2: null }, "再利用IDを期間差と誤認しない");

  const previous = await api.savePreviousAmounts(restored, { industryId: draft.industryId, departmentId: draft.departmentId, rows: [{ accountId, amounts: { 4: "1" } }] });
  assert.ok((await api.readPlanContents(previous)).details.filter(detail => detail.kindId === 0).every(detail => detail.startYearMonth === null));
  const plan = { ...await api.readPlanContents(restored), bytes: restored, name: "開始年月.triadic", handle: {
    name: "開始年月.triadic", async getFile() { return new File([restored], this.name); }, async createWritable() {
      return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} };
    },
  } };
  await assert.rejects(api.saveDetailChange(plan, { target: plan.details[0], field: "amount", value: "3" }), /保存失敗/);
  assert.deepEqual(plan.initiatives[0].startYearMonths, item.startYearMonths, "保存失敗で元の開始年月を維持");
  console.log("PASS: 開始年月の読込時導出、期間差、手修正0、相殺、未確定、明細更新、改名、復元、保存失敗");
}
