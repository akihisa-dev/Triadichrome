import assert from "node:assert/strict";

export async function verifySingleYearPlan(api) {
  let bytes = await api.createTriadicDatabase(2027);
  let contents = await api.readPlanContents(bytes);
  assert.equal(contents.fiscalYear, 2027);
  assert.deepEqual(contents.kinds.map(kind => kind.kindName), ["一次予算", "確定予算"]);
  const account = contents.accounts.find(account => account.accountType === "sales");
  const draft = { ...api.createInitiativeDraft("2027"), name: "引き継ぎ確認", expansionId: contents.expansions[0].id, industryId: contents.industries[0].id, departmentId: contents.departments[0].id,
    rows: [{ accountId: account.id, amounts: { 4: "100", 10: "100" }, overrides: { 2: { 10: "150", 11: "0" } } }] };
  await assert.rejects(api.registerInitiative(bytes, { ...draft, fiscalYear: "2028" }), /基準年度/);
  await assert.rejects(api.registerInitiative(bytes, { ...draft, industryId: null }), /業種/);
  await assert.rejects(api.registerInitiative(bytes, { ...draft, departmentId: null }), /部署/);
  await assert.rejects(api.registerInitiative(bytes, { ...draft, rows: [{ ...draft.rows[0], overrides: { 3: { 4: "1" } } }] }), /種別/);
  bytes = await api.registerInitiative(bytes, draft);
  contents = await api.readPlanContents(bytes);
  const initiative = contents.initiatives[0];
  const row = initiative.rows[0];
  assert.equal(api.resolvedAmount(row, 2, 4), "100");
  assert.equal(api.resolvedAmount(row, 2, 10), "150");
  assert.equal(api.resolvedAmount(row, 2, 11), "0", "手修正0を維持する");
  const changed = { ...draft, rows: [{ ...row, amounts: { ...row.amounts, 4: "120", 10: "120", 11: "120" } }] };
  bytes = await api.updateInitiative(bytes, initiative.id, 2027, changed);
  contents = await api.readPlanContents(bytes);
  const updated = contents.initiatives[0].rows[0];
  assert.equal(api.resolvedAmount(updated, 2, 4), "120", "未修正月は一次予算に追従する");
  assert.equal(api.resolvedAmount(updated, 2, 10), "150", "手修正は固定する");
  assert.equal(api.resolvedAmount(updated, 2, 11), "0");
  await assert.rejects(api.updateInitiative(bytes, initiative.id, 2027, { ...changed, rows: [{ ...updated, accountId: contents.accounts[1].id }] }), /全種別/);
  assert.equal(api.canChangeAccountRow({ amounts: { 4: "0.001", 5: "-0.001" } }), false, "合計0でも使用中");
  assert.equal(api.canChangeAccountRow({ amounts: { 4: "0.0001" } }), false, "編集中の不正値で画面を落とさず科目操作を止める");
  assert.equal(api.canChangeAccountRow({ amounts: {}, overrides: { 2: { 10: "0.001" } } }), false, "確定予算だけ非0でも使用中");
  assert.equal(api.canChangeAccountRow({ amounts: {}, overrides: { 2: { 4: "0" } } }), true);
  bytes = await api.savePreviousAmounts(bytes, { industryId: draft.industryId, departmentId: draft.departmentId, rows: [{ accountId: account.id, amounts: { 4: "1000.001" } }] });
  contents = await api.readPlanContents(bytes);
  assert.equal(contents.previousAmounts[0].amount, "1000.001");
  bytes = await api.savePreviousAmounts(bytes, { industryId: draft.industryId, departmentId: draft.departmentId, rows: [{ accountId: account.id, amounts: { 4: "1001" } }] });
  contents = await api.readPlanContents(bytes);
  assert.equal(contents.previousAmounts.length, 1, "同じ組み合わせは更新する");
  assert.equal(contents.previousAmounts[0].amount, "1001");
  assert.deepEqual(contents.kindSelections, { "initiative-list": [2], "cost-table": [1], "expansion-table": [1] });
  for (const screen of ["cost-table", "expansion-table"]) {
    for (const selected of [[1, 2], [2, 1], [2], [1]]) {
      bytes = await api.saveKindSelection(bytes, screen, selected);
      assert.deepEqual((await api.readPlanContents(bytes)).kindSelections[screen], selected);
    }
    for (const selected of [[], [1, 1], [1, 3], [0], [4], [5]]) await assert.rejects(api.saveKindSelection(bytes, screen, selected), /選択/);
  }
  await assert.rejects(api.saveKindSelection(bytes, "initiative-list", [1, 2]), /選択/);
  await assert.rejects(api.saveKindSelection(bytes, "unknown", [1]), /表示対象/);
  bytes = await api.saveKindSelection(bytes, "initiative-list", [1]);
  contents = await api.readPlanContents(bytes);
  assert.deepEqual(contents.kindSelections["initiative-list"], [1]);
  const cost = api.buildKindCostTable(contents, [1, 2]).find(row => row.kind === "account" && row.id === account.id);
  assert.deepEqual(cost.values.map(values => values[4]), [1001, 1121, 1121], "前年＋各種別の前年差");
  assert.deepEqual(cost.values.map(values => values[10]), [0, 120, 150]);
  assert.equal(api.buildKindCostTable(contents, [1])[0].values.length, 2);
  const expansion = api.buildKindExpansionTable(contents, [1, 2], "registered");
  assert.deepEqual(expansion.total.map(months => months[10].sales), [120, 150, 30]);
  const reversed = api.buildKindExpansionTable(contents, [2, 1], "registered");
  assert.deepEqual(reversed.total.map(months => months[10].sales), [150, 120, 30], "比較は選択順に関係なく確定−一次");
  assert.deepEqual(reversed.groups[0].initiatives[0].values.map(months => months[10].sales), [150, 120, 30]);
  const single = api.buildKindExpansionTable(contents, [1], "registered");
  assert.equal(single.total.length, 1);
  assert.equal(single.previous.length, 1);
  assert.equal(single.changes.length, 1);
  assert.equal(single.groups[0].values.length, 1);
  assert.equal(single.groups[0].initiatives[0].values.length, 1);
  assert.deepEqual(expansion.total.map(months => months[4].sales), [1121, 1121, 0]);
  bytes = await api.savePreviousAmounts(bytes, { industryId: contents.industries[1].id, departmentId: contents.departments[1].id, rows: [{ accountId: account.id, amounts: { 4: "20" } }] });
  contents = await api.readPlanContents(bytes);
  const filtered = api.filterPlan(contents, { industries: [draft.industryId], departments: [draft.departmentId] });
  assert.equal(api.previousTotals(contents)[4].sales, 1021);
  assert.equal(api.previousTotals(filtered)[4].sales, 1001);
  assert.equal(api.filterPlan(contents, { industries: [draft.industryId], departments: [contents.departments[1].id] }).initiatives.length, 0, "業種と部署の両方に一致した施策だけ");
  assert.equal(api.filterPlan(contents, { industries: [draft.industryId, contents.industries[1].id], departments: null }).previousAmounts.length, 2, "同じ分類内はどれかに一致");
  const prior = contents.details.find(detail => detail.kindId === 0 && detail.industryId === draft.industryId);
  assert.equal(prior.initiativeName, "前年"); assert.equal(prior.kindName, "前年");
  assert.ok(contents.details.every(detail => detail.fiscalYear === 2027));
  const confirmed = contents.details.find(detail => detail.kindId === 2 && detail.month === 4);
  bytes = await api.changeDetail(bytes, { target: confirmed, field: "amount", value: "90" });
  contents = await api.readPlanContents(bytes);
  assert.equal(contents.details.find(detail => detail.kindId === 2 && detail.month === 4).amount, "90");
  assert.equal(contents.details.find(detail => detail.kindId === 1 && detail.month === 4).amount, "120");
  await assert.rejects(api.changeDetail(bytes, { target: confirmed, field: "amount", value: "91" }), /変更されています/);
  await assert.rejects(api.changeDetail(bytes, { target: contents.details.find(detail => detail.kindId === 2 && detail.month === 4), field: "fiscalYear", value: "2028" }), /固定/);
  const latestPrior = contents.details.find(detail => detail.id === prior.id);
  bytes = await api.changeDetail(bytes, { target: latestPrior, field: "amount", value: "1002" });
  contents = await api.readPlanContents(bytes);
  assert.equal(api.previousTotals(contents)[4].sales, 1022);
  for (const [change, id] of [[api.changeAccountMaster, account.id], [api.changeIndustryMaster, draft.industryId], [api.changeDepartmentMaster, draft.departmentId]]) {
    await assert.rejects(change(bytes, { type: "delete", id }), /使用|前年/);
  }
  const zeroDraft = { ...draft, name: "全行0", rows: [{ accountId: account.id, amounts: {} }] };
  bytes = await api.registerInitiative(bytes, zeroDraft);
  const zero = (await api.readPlanContents(bytes)).initiatives.find(item => item.name === "全行0");
  bytes = await api.updateInitiative(bytes, zero.id, 2027, { ...zeroDraft, rows: [] });
  assert.equal((await api.readPlanContents(bytes)).initiatives.find(item => item.id === zero.id).rows.length, 0, "最後の行も全種別0なら削除できる");
  const beforeReset = (await api.readPlanContents(bytes)).initiatives[0];
  const resetRows = beforeReset.rows.map(row => ({ ...row, overrides: { ...row.overrides, 2: {} } }));
  bytes = await api.updateInitiative(bytes, beforeReset.id, 2027, { ...changed, rows: resetRows });
  const afterReset = (await api.readPlanContents(bytes)).initiatives[0].rows[0];
  assert.equal(api.resolvedAmount(afterReset, 2, 11), "120", "手修正0を解除すると一次予算を引き継ぐ");
  assert.equal(api.resolvedAmount(afterReset, 2, 4), "120");
  await assert.rejects(api.changeKindMaster(bytes, { type: "delete", id: 1 }), /固定/);
  const db = await api.openTriadicDatabase(bytes);
  try {
    assert.throws(() => db.run("UPDATE budgets SET fiscal_year = 2028"), /固定/);
    assert.throws(() => db.run("DELETE FROM kind_types WHERE id = 1"), /固定/);
    db.exec("PRAGMA user_version = 13; UPDATE triadic_metadata SET value = '13' WHERE key = 'format_version';");
    await assert.rejects(api.openTriadicDatabase(db.export()), /対応していません/);
  } finally { db.close(); }
  console.log("PASS: 単年度、月別引き継ぎ、2種の比較、共通行、前年入力、種別選択の保存");
}
