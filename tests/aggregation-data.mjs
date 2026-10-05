import assert from "node:assert/strict";

export async function verifyAggregationData(api) {
  const { createTriadicDatabase, changeAccountMaster, changeAggregationMaster, readPlanContents, registerInitiative,
    buildCostTable, openTriadicDatabase, validateTriadicDatabase, saveAggregationMaster, saveAccountMaster, layoutAggregationGraph, aggregationNodeWidth } = api;
  let bytes = await createTriadicDatabase();
  let contents = await readPlanContents(bytes);
  assert.deepEqual(contents.aggregations.map(group => group.name), ["売上集計", "費用集計", "営業利益", "経常利益"]);
  for (const group of contents.aggregations) {
    await assert.rejects(changeAggregationMaster(bytes, { type: "delete", id: group.id }), /必須/);
    await assert.rejects(changeAggregationMaster(bytes, { type: "update", id: group.id, name: "改名", members: [] }), /必須/);
  }
  for (const [code, name, type] of [["200", "原価", "cost"], ["100", "売上", "sales"], ["500", "費用", "expense"], ["900", "利益", "profit"]]) {
    bytes = (await changeAccountMaster(bytes, { type: "add", accountCode: code, accountName: name, accountType: type })).bytes;
  }
  const original = bytes.slice();
  const ids = (await readPlanContents(bytes)).accounts.map(account => account.id);
  bytes = (await changeAccountMaster(bytes, { type: "reorder", ids: [ids[1], ids[0], ids[2], ids[3]] })).bytes;
  contents = await readPlanContents(bytes);
  assert.deepEqual(contents.accounts.map(account => account.accountName), ["売上", "原価", "費用", "利益"]);
  assert.deepEqual((await readPlanContents(original)).accounts.map(account => account.accountName), ["原価", "売上", "費用", "利益"]);
  for (const badIds of [[], [ids[0], ids[0], ids[2], ids[3]], [...ids, 999], [999, ...ids.slice(1)]]) await assert.rejects(changeAccountMaster(bytes, { type: "reorder", ids: badIds }), /一致/);
  const [salesAccount, costAccount, expenseAccount, profitAccount] = contents.accounts;
  const member = (kind, id, sign = 1) => ({ kind, id, sign });
  const update = async (id, members) => {
    const group = (await readPlanContents(bytes)).aggregations.find(item => item.id === id);
    bytes = await changeAggregationMaster(bytes, { type: "update", id, name: group.name, members });
  };
  bytes = await changeAggregationMaster(bytes, { type: "add", name: "売上小計" });
  const custom = (await readPlanContents(bytes)).aggregations.at(-1);
  await update(custom.id, [member("account", salesAccount.id)]);
  await update(1, [member("group", custom.id), member("account", costAccount.id, -1)]);
  await update(2, [member("account", expenseAccount.id)]);
  await update(3, [member("group", 1), member("group", 2, -1)]);
  await update(4, [member("group", 3), member("account", profitAccount.id)]);
  await assert.rejects(changeAggregationMaster(bytes, { type: "add", name: "売上集計" }), /同じ名前/);
  await assert.rejects(changeAggregationMaster(bytes, { type: "add", name: " " }), /集計名/);
  await assert.rejects(changeAggregationMaster(bytes, { type: "delete", id: custom.id }), /使用中/);
  await assert.rejects(changeAccountMaster(bytes, { type: "delete", id: salesAccount.id }), /使用/);
  await assert.rejects(update(2, [member("account", salesAccount.id)]), /重複/);
  await assert.rejects(update(2, [member("account", expenseAccount.id), member("account", expenseAccount.id)]), /重複/);
  await assert.rejects(update(2, [member("group", custom.id)]), /重複/);
  await assert.rejects(update(4, [member("group", 4)]), /循環/);
  await assert.rejects(update(custom.id, [member("group", 4)]), /循環/);
  await assert.rejects(update(4, [member("account", 999)]), /見つかりません/);
  await assert.rejects(update(4, [member("account", profitAccount.id, 0)]), /加算/);
  await validateTriadicDatabase(bytes);

  const configured = (await readPlanContents(bytes)).aggregations;
  for (const graphGroups of [configured, [...configured, { id: 9999, name: "独立した集計", required: null, members: [] }]]) for (const width of [320, 1200]) {
    const layout = layoutAggregationGraph(graphGroups, new Map([[1, 400], [2, 160], [3, 48], [4, 90], [custom.id, 210]]), width);
    assert.equal(new Set(layout.nodes.map(node => node.id)).size, graphGroups.length);
    for (const node of layout.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0 && node.x + aggregationNodeWidth <= layout.width && node.y + node.height <= layout.height);
      for (const other of layout.nodes.filter(other => other.id !== node.id)) {
        assert.ok(node.x + aggregationNodeWidth <= other.x || other.x + aggregationNodeWidth <= node.x || node.y + node.height <= other.y || other.y + other.height <= node.y, "高さが違う集計枠を重ねない");
      }
      const children = graphGroups.find(group => group.id === node.id).members.filter(item => item.kind === "group").map(child => layout.nodes.find(item => item.id === child.id));
      for (const child of children) assert.ok(child.y >= node.y + node.height + 100, "最終集計を上に置き、ドロップ領域を空けて内訳を下へ広げる");
      for (let index = 1; index < children.length; index++) {
        assert.ok(children[index].x > children[index - 1].x, "同じ親の内訳は順序を保って左右へ並べる");
        assert.equal(children[index].y, children[0].y, "高さの違う集計も同じ段の上端を揃える");
      }
    }
  }

  // Moving membership is atomic, preserves descendants and never duplicates an item.
  const move = (kind, id, parentId, sign = 1) => ({ type: "move", member: { kind, id }, parentId, sign });
  const movedBytes = await changeAggregationMaster(bytes, move("account", expenseAccount.id, custom.id, -1));
  const movedGroups = (await readPlanContents(movedBytes)).aggregations;
  assert.equal(movedGroups.find(group => group.id === 2).members.length, 0);
  assert.deepEqual(movedGroups.find(group => group.id === custom.id).members.at(-1), member("account", expenseAccount.id, -1));
  assert.equal(movedGroups.flatMap(group => group.members).filter(item => item.kind === "account" && item.id === expenseAccount.id).length, 1);
  assert.deepEqual((await readPlanContents(bytes)).aggregations.find(group => group.id === 2).members, [member("account", expenseAccount.id)], "元のバイト列を変更しない");
  const regrouped = await changeAggregationMaster(bytes, move("group", custom.id, 2, -1));
  const regroupedGroups = (await readPlanContents(regrouped)).aggregations;
  assert.deepEqual(regroupedGroups.find(group => group.id === custom.id).members, [member("account", salesAccount.id)], "子集計の配下を維持");
  assert.equal(regroupedGroups.find(group => group.id === 1).members.some(item => item.kind === "group" && item.id === custom.id), false);
  const released = await changeAggregationMaster(regrouped, move("group", custom.id, null));
  assert.equal((await readPlanContents(released)).aggregations.flatMap(group => group.members).some(item => item.kind === "group" && item.id === custom.id), false);
  const signChanged = await changeAggregationMaster(bytes, move("group", 2, 3, 1));
  assert.equal((await readPlanContents(signChanged)).aggregations.find(group => group.id === 3).members.find(item => item.id === 2).sign, 1);
  for (const change of [move("group", 4, custom.id), move("group", 3, 3), move("account", 999, null), move("account", salesAccount.id, 999), move("group", 999, null), move("account", salesAccount.id, 2, 0)]) await assert.rejects(changeAggregationMaster(bytes, change));

  for (const [name, year, rows] of [
    ["施策A", "2026", [{ accountId: salesAccount.id, amounts: { 4: "100", 5: "0", 3: "1.25" } }, { accountId: salesAccount.id, amounts: { 4: "25.5" } },
      { accountId: costAccount.id, amounts: { 4: "30" } }, { accountId: expenseAccount.id, amounts: { 4: "20", 6: "-5.5" } }, { accountId: profitAccount.id, amounts: { 4: "10" } }]],
    ["施策B", "2026", [{ accountId: salesAccount.id, amounts: { 4: "-5.5", 3: "-0.25" } }]],
    ["前年の増減施策", "2025", [{ accountId: salesAccount.id, amounts: { 4: "9999" } }]],
  ]) bytes = await registerInitiative(bytes, { name, note: "", fiscalYear: year, rows });
  contents = await readPlanContents(bytes);
  const build = (year = 2026, previous) => buildCostTable(contents.accounts, contents.aggregations, contents.initiatives, year, previous);
  const table = build();
  assert.deepEqual(table.map(row => row.name), ["売上", "売上小計", "原価", "売上集計", "費用", "費用集計", "営業利益", "利益", "経常利益"]);
  assert.deepEqual(table.map(row => row.budget[4]), [120, 120, 30, 90, 20, 20, 70, 10, 80]);
  assert.ok(table.every(row => Object.keys(row.previous).length === 0), "前年の増減施策を前年合計値の代わりに使わない");
  assert.equal(table[0].budget[5], 0, "入力ゼロを保持");
  assert.equal(table[0].budget[7], undefined, "未入力月は空白");
  assert.equal(table[0].budget[3], 1, "翌3月も選択年度に含める");
  assert.equal(table.at(-1).budget[6], 5.5, "マイナスの費用は減算時に加算になる");
  const baseline = new Map([[salesAccount.id, { 4: 1000, 7: 50 }], [costAccount.id, { 4: 200 }], [expenseAccount.id, { 4: 300 }], [profitAccount.id, { 4: 10 }]]);
  const expanded = build(2026, baseline);
  assert.equal(expanded[0].budget[4], 1120);
  assert.equal(expanded[0].budget[7], 50, "施策なしでも前年値は維持");
  assert.equal(expanded.at(-1).previous[4], 510);
  assert.equal(expanded.at(-1).budget[4], 590, "前年＋増減と階層集計が一致");
  assert.equal(build(2025)[0].budget[4], 9999);
  assert.ok(build(2027).every(row => Object.keys(row.budget).length === 0));
  const unconfigured = structuredClone(contents.aggregations);
  unconfigured.find(group => group.id === custom.id).members = [];
  const incomplete = buildCostTable(contents.accounts, unconfigured, contents.initiatives, 2026);
  assert.equal(incomplete.find(row => row.name === "経常利益").configured, false);
  assert.deepEqual(incomplete.find(row => row.name === "経常利益").budget, {}, "未設定の子集計を含む部分合計を確定額として出さない");

  const legacyDb = await openTriadicDatabase(original);
  legacyDb.exec("DROP TABLE expansions; DROP TABLE aggregation_members; DROP TABLE aggregation_groups; PRAGMA user_version = 2; UPDATE triadic_metadata SET value = '2' WHERE key = 'format_version';");
  const legacyBytes = legacyDb.export(); legacyDb.close();
  const legacy = await readPlanContents(legacyBytes);
  assert.deepEqual(legacy.accounts.map(account => account.accountName), ["売上", "原価", "費用", "利益"], "旧版のコード順を読込時に維持");
  assert.equal(legacy.aggregations.length, 4);
  const migrated = await changeAggregationMaster(legacyBytes, { type: "add", name: "移行後の集計" });
  assert.deepEqual((await readPlanContents(migrated)).accounts.map(account => account.accountName), legacy.accounts.map(account => account.accountName));
  const untouched = await openTriadicDatabase(legacyBytes);
  assert.equal(untouched.exec("PRAGMA user_version")[0].values[0][0], 2); untouched.close();
  const invalid = await openTriadicDatabase(bytes);
  invalid.exec("DELETE FROM aggregation_members; DELETE FROM aggregation_groups WHERE required_key = 'sales';");
  await assert.rejects(validateTriadicDatabase(invalid.export())); invalid.close();

  let stored = bytes.slice();
  let writes = 0;
  const handle = { name: "plan.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() {
    let pending;
    return { async write(value) { pending = value; writes++; }, async close() { stored = new Uint8Array(pending); }, async abort() {} };
  } };
  const plan = { ...contents, bytes, name: handle.name, handle };
  const noPicker = () => { throw new Error("保存先を再選択しない"); };
  const add = { type: "add", name: "追加集計" };
  const saved = await saveAggregationMaster(plan, add, noPicker);
  assert.deepEqual((await readPlanContents(stored)).aggregations, saved.aggregations);
  await assert.rejects(saveAggregationMaster(plan, add, noPicker), /別の操作で更新/);
  assert.equal(writes, 1);
  const beforeFailure = stored.slice();
  for (const stage of ["write", "close"]) {
    let aborted = false;
    const failedHandle = { ...handle, async createWritable() { return {
      async write() { if (stage === "write") throw new Error("保存失敗"); }, async close() { if (stage === "close") throw new Error("保存失敗"); }, async abort() { aborted = true; },
    }; } };
    await assert.rejects(saveAggregationMaster({ ...saved, handle: failedHandle }, { ...add, name: "失敗集計" }, noPicker), /保存失敗/);
    await assert.rejects(saveAggregationMaster({ ...saved, handle: failedHandle }, move("account", salesAccount.id, 2), noPicker), /保存失敗/);
    await assert.rejects(saveAccountMaster({ ...saved, handle: failedHandle }, { type: "reorder", ids: [...saved.accounts].reverse().map(account => account.id) }, noPicker), /保存失敗/);
    assert.equal(aborted, true);
    assert.deepEqual(stored, beforeFailure);
  }
  await assert.rejects(saveAggregationMaster({ ...contents, bytes, name: handle.name }, add, async () => { throw new DOMException("キャンセル", "AbortError"); }), { name: "AbortError" });
  await assert.rejects(saveAggregationMaster({ ...contents, bytes, name: handle.name }, move("group", custom.id, 2), async () => { throw new DOMException("キャンセル", "AbortError"); }), { name: "AbortError" });
  const removed = await changeAggregationMaster(saved.bytes, { type: "delete", id: saved.aggregations.at(-1).id });
  assert.deepEqual((await readPlanContents(removed)).aggregations, contents.aggregations);
  console.log("PASS: mandatory aggregations, nested +/- totals, unique membership, cycles, baseline expansion, ordering, migration and protected saves");
}
