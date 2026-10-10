import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function verifySamplePlan(api) {
  const { createSamplePlan, validateTriadicDatabase, readPlanContents, buildCostTable, initiativeMonths, changeAccountMaster, changeAggregationMaster, openTriadicDatabase } = api;
  const bytes = await createSamplePlan(2026);
  await validateTriadicDatabase(bytes);
  const history = await api.readDataHistory(bytes);
  assert.equal(history.entries.length, 3);
  assert.equal(history.dirtySince, null);
  const older = await api.readSnapshotContents(await api.readHistorySnapshot(bytes, history.entries[2].id));
  assert.equal(older.initiatives[0].rows[0].amounts[4], "100");
  assert.equal(older.initiatives[0].note, "履歴確認用の過去の状態");
  assert.deepEqual(older.previousAmounts, (await readPlanContents(bytes)).previousAmounts);

  const { accounts, initiatives, aggregations, expansions, industries } = await readPlanContents(bytes);
  assert.deepEqual(expansions.map(item => item.expansionCode), ["1", "2", "3", "4", "5", "8", "9"]);
  assert.deepEqual((await readPlanContents(bytes)).departments.map(item => item.departmentName), ["部署A", "部署B"]);
  assert.deepEqual((await readPlanContents(bytes)).kinds.map(item => item.kindName), ["一次予算", "確定予算"]);
  assert.deepEqual((await readPlanContents(bytes)).periodTypes.map(item => item.periodName), ["期間差", "新規"]);
  assert.deepEqual(new Set(initiatives.map(item => item.industryId)), new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  assert.deepEqual(new Set(initiatives.map(item => item.periodTypeId)), new Set([1, 2, null]));
  assert.deepEqual(industries.map(item => item.industryName), ["直営自動車", "自動車取扱", "不動産A", "不動産B", "納品代行", "雑作業", "業務費B", "一般管理費", "営業外"]);
  assert.equal(accounts.length, 59);
  assert.equal(aggregations.length, 16);
  assert.equal(initiatives.length, 14);
  assert.ok(initiatives.every(item => item.departmentId != null && item.industryId != null), "全施策に業種・部署がある");
  assert.deepEqual(new Set(accounts.map(account => account.accountType)), new Set(["sales", "cost", "expense", "profit"]));
  assert.equal(accounts[0].accountCode, "401");
  assert.deepEqual([...new Set(initiatives.map(item => item.fiscalYear))].sort(), [2026]);
  const product = initiatives.find(item => item.name === "既存商品の販売拡大");
  assert.equal(product.rows[0].accountId, product.rows[1].accountId);
  assert.equal(product.rows[0].amounts[4], "120");
  assert.equal(product.rows[0].amounts[3], "175");
  assert.equal(product.months[4].sales, 90000);
  assert.equal(product.months[4].profit, 79125);
  assert.equal(product.months[4].expense, 11000, "売上原価と利益属性を費用に含めない");
  const zero = initiatives.find(item => item.name === "ゼロと相殺の確認");
  assert.deepEqual(zero.months[4], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(zero.months[5], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(zero.months[6], { sales: 0, expense: 0, profit: 0 });
  assert.equal(initiatives.find(item => item.name === "通信運搬費と消耗品費の削減").months[4].profit, 3750);
  const reduction = initiatives.find(item => item.name === "通信運搬費と消耗品費の削減");
  assert.equal(reduction.rows[1].amounts[3], "-1.251");
  assert.equal(reduction.months[3].expense, -3751, "費用の削減額と1円の端数を保持する");
  assert.equal(reduction.months[3].profit, 3751, "1円の端数を保存・再読込・計算で保持する");
  for (const year of [2026]) {
    const table = buildCostTable(accounts, aggregations, initiatives, year);
    assert.ok(table.every(item => Object.keys(item.previous).length === 0), "別年度の施策を前年合計値にしない");
    assert.ok(table.filter(item => item.required).every(item => item.configured), "必須4集計をすぐ確認できる");
    const ordinary = table.find(item => item.name === "経常利益");
    for (const month of initiativeMonths) {
      const expected = initiatives.filter(item => item.fiscalYear === year).reduce((total, item) => total + (item.months[month]?.profit ?? 0), 0);
      assert.equal(ordinary.budget[month], expected, "科目属性による施策別利益と集計マスタの階層計算が一致する");
    }
  }
  const plan = await readPlanContents(bytes);
  assert.equal(plan.previousAmounts.length, 9 * 2 * (4 * 12 + 4));
  assert.equal(api.previousTotals(plan)[4].sales, 20342250);
  assert.equal(api.previousTotals(plan)[4].profit, 16922250);
  const combined = api.buildKindExpansionTable(plan, [1, 2], "registered");
  assert.equal(combined.changes[0][4].sales, 415000);
  assert.equal(combined.total[0][4].sales, 20757250);
  assert.equal(combined.total[0][4].profit, 17290125);
  assert.equal(plan.details.length, 1704);
  assert.deepEqual(plan.initiatives.find(item => item.name === "保守サービスの新規契約").startYearMonths, { 1: "2026-07", 2: "2026-08" });
  assert.deepEqual(plan.initiatives.find(item => item.name === "期間差の開始年月確認").startYearMonths, { 1: "2025-10", 2: "2025-11" });
  const starts = [
    ["既存商品の販売拡大", "2026-04", "2026-04"], ["保守サービスの新規契約", "2026-07", "2026-08"],
    ["季節キャンペーン", "2026-05", "2026-05"], ["通信運搬費と消耗品費の削減", "2026-04", "2026-04"],
    ["サブスクリプション事業の拡大", "2026-04", "2026-04"], ["設備更新と償却費の見直し", "2026-09", "2026-09"],
    ["助成金の受入れ", "2026-09", "2026-09"], ["ゼロと相殺の確認", "2026-05", "2026-05"],
    ["未確定施策の入力準備", null, null], ["確定予算の手修正", "2026-04", "2026-04"],
    ["確定予算の下期調整", "2026-04", "2026-04"], ["確定予算のゼロ固定", "2026-04", "2026-04"],
    ["科目変更と削除の確認", null, null], ["期間差の開始年月確認", "2025-10", "2025-11"],
  ];
  assert.equal(starts.length, plan.initiatives.length, "全施策の開始年月を照合する");
  for (const [name, primary, confirmed] of starts) {
    const item = plan.initiatives.find(item => item.name === name);
    assert.deepEqual(item.startYearMonths, { 1: primary, 2: confirmed }, `${name}の開始年月`);
    for (const kind of [1, 2]) assert.ok(plan.details.filter(detail => detail.initiativeId === item.id && detail.kindId === kind)
      .every(detail => detail.startYearMonth === (kind === 1 ? primary : confirmed)), `${name}の明細の開始年月`);
  }
  assert.ok(plan.details.every(row => row.fiscalYear === 2026));
  assert.ok(plan.details.filter(row => row.kindId === 0).every(row => row.initiativeName === "前年" && row.kindName === "前年"));
  const unused = accounts.find(item => item.accountName === "削除確認用科目");
  assert.equal(unused.inUse, false);
  assert.equal((await changeAccountMaster(bytes, { type: "delete", id: unused.id })).accounts.length, 58);
  const blank = accounts.find(item => item.accountName === "未所属費用");
  assert.equal(blank.inUse, true);
  assert.ok(!aggregations.some(item => item.members.some(member => member.kind === "account" && member.id === blank.id)));
  await assert.rejects(changeAccountMaster(bytes, { type: "delete", id: blank.id }), /使用/);
  const disposable = aggregations.find(item => item.name === "編集・削除確認用集計");
  assert.equal((await readPlanContents(await changeAggregationMaster(bytes, { type: "delete", id: disposable.id }))).aggregations.length, 15);
  const database = await openTriadicDatabase(bytes);
  try {
    assert.deepEqual(database.exec("SELECT created_at, updated_at FROM document_info")[0].values, [["2026-04-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z"]], "確認用の作成・更新日時を再生成のたびに変更しない");
    assert.deepEqual(plan.details.filter(row => row.initiativeId === product.id && row.kindId === 1 && [4,3].includes(row.month)).slice(0,2).map(row => [row.year,row.month]), [[2026,4],[2027,3]]);
  } finally { database.close(); }
  assert.equal((await readPlanContents(bytes)).accounts.length, 59, "削除確認後も元データを再利用できる");
  const largeBytes = new Uint8Array(await readFile(new URL("../samples/全機能確認用.triadic", import.meta.url)));
  await validateTriadicDatabase(largeBytes);
  const large = await readPlanContents(largeBytes);
  assert.equal(large.departments.length, 4);
  const multiple = large.departments.find(item => item.departmentName === "複数業種確認部署");
  const single = large.departments.find(item => item.departmentName === "単一業種確認部署");
  assert.deepEqual(multiple.industryIds, [1, 2]);
  assert.deepEqual(single.industryIds, [3]);
  for (const department of [multiple, single]) {
    assert.ok(!large.initiatives.some(item => item.departmentId === department.id));
    assert.ok(!large.previousAmounts.some(item => item.departmentId === department.id));
  }
  assert.ok(large.initiatives.every(item => large.departments.find(d => d.id === item.departmentId).industryIds.includes(item.industryId)));
  assert.ok(large.previousAmounts.every(item => large.departments.find(d => d.id === item.departmentId).industryIds.includes(item.industryId)));
  const allowedDraft = { name: "所属業種の登録確認", note: "", fiscalYear: String(large.fiscalYear), expansionId: large.expansions[0].id, departmentId: multiple.id, industryId: 2, rows: [{ accountId: large.accounts[0].id, amounts: { 4: "1.001" } }] };
  const registered = await readPlanContents(await api.registerInitiative(largeBytes, allowedDraft));
  assert.equal(registered.initiatives.at(-1).industryId, 2);
  await assert.rejects(api.registerInitiative(largeBytes, { ...allowedDraft, industryId: 3 }), /部署に設定/);
  const modified = await api.changeDepartmentMaster(largeBytes, { type: "update", id: multiple.id, departmentName: multiple.departmentName, industryIds: [2] });
  assert.deepEqual((await readPlanContents(modified)).departments.find(item => item.id === multiple.id).industryIds, [2]);
  assert.deepEqual((await readPlanContents(largeBytes)).departments.find(item => item.id === multiple.id).industryIds, [1, 2], "変更検証で原本を更新しない");
  const added = large.initiatives.filter(item => item.name.startsWith("大規模確認施策"));
  assert.equal(large.initiatives.length, 14 + api.LARGE_SAMPLE_INITIATIVES);
  assert.equal(added.length, 1000);
  assert.equal(large.details.length, 1704 + 1000 * 12 * 12 * 2);
  assert.ok(largeBytes.length > bytes.length * 10, "実ファイルを従来の10倍以上に拡大する");
  assert.deepEqual(new Set(added.map(item => item.expansionId)), new Set(large.expansions.map(item => item.id)));
  assert.deepEqual(new Set(added.map(item => item.industryId)), new Set(large.industries.map(item => item.id)));
  assert.deepEqual(new Set(added.map(item => item.departmentId)), new Set(large.departments.filter(item => item.departmentName === "部署A" || item.departmentName === "部署B").map(item => item.id)));
  for (const item of added) {
    assert.equal(item.rows.length, 12);
    assert.deepEqual(item.startYearMonths, { 1: `${api.currentFiscalYear()}-04`, 2: `${api.currentFiscalYear()}-04` });
    for (const kind of [1, 2]) {
      const projected = api.initiativesForKind([item], large.accounts, kind)[0];
      for (const month of initiativeMonths) assert.deepEqual(projected.months[month], { sales: 0, expense: 0, profit: 0 });
    }
  }
  const largeCombined = api.buildKindExpansionTable(large, [1, 2], "registered");
  assert.deepEqual(largeCombined.total, combined.total, "大規模化しても元の確認用合計を保持する");
  const largeHistory = await api.readDataHistory(largeBytes);
  assert.equal(largeHistory.entries.length, 3);
  const largeOlder = await api.readSnapshotContents(await api.readHistorySnapshot(largeBytes, largeHistory.entries[2].id));
  assert.equal(largeOlder.initiatives.length, 1014, "過去の履歴にも大規模データを保持する");
  assert.equal(largeOlder.initiatives[0].rows[0].amounts[4], "100");
  assert.deepEqual(largeOlder.departments, large.departments, "追加した所属確認部署も履歴に保持する");
  console.log("PASS: sample plan years, monthly edge cases, configured totals and editable/deletable master data");
}
