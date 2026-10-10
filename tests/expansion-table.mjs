import assert from "node:assert/strict";

export async function verifyExpansionTable(api) {
  const { createTriadicDatabase, registerInitiative, updateInitiative, readPlanContents, changeExpansionMaster,
    buildExpansionTable, createInitiativeDraft, openTriadicDatabase, validateTriadicDatabase } = api;
  let bytes = await createTriadicDatabase();
  const initial = await readPlanContents(bytes);
  const accountId = initial.accounts.find(item => item.accountType === "sales").id;
  const draft = { ...createInitiativeDraft("2026"), industryId: 1, departmentId: 1, name: "施策B", rows: [{ accountId, amounts: { 4: "100.001", 5: "0" } }] };
  assert.equal(draft.expansionId, null);
  await assert.rejects(registerInitiative(bytes, draft), /展開名/);
  await assert.rejects(registerInitiative(bytes, { ...draft, expansionId: 999 }), /展開名/);
  bytes = await registerInitiative(bytes, { ...draft, expansionId: 1 });
  bytes = await registerInitiative(bytes, { ...draft, name: "施策A", expansionId: 1, rows: [{ accountId, amounts: { 4: "-0.001" } }] });
  bytes = await registerInitiative(bytes, { ...draft, name: "別展開", expansionId: 2 });
  await assert.rejects(registerInitiative(bytes, { ...draft, name: "別年度", expansionId: 1, fiscalYear: "2025" }), /基準年度/);
  const contents = await readPlanContents(bytes);
  const build = sort => buildExpansionTable(contents, 2026, sort);
  assert.equal(build("registered").groups.length, 7);
  assert.deepEqual(build("registered").groups.map(item => item.expansion.expansionCode), ["1", "2", "3", "4", "5", "8", "9"]);
  assert.deepEqual(build("registered").groups[0].initiatives.map(item => item.name), ["施策B", "施策A"]);
  assert.deepEqual(build("asc").groups[0].initiatives.map(item => item.name), ["施策A", "施策B"]);
  assert.deepEqual(build("desc").groups[0].initiatives.map(item => item.name), ["施策B", "施策A"]);
  assert.deepEqual(contents.initiatives.slice(0, 2).map(item => item.name), ["施策B", "施策A"], "表示順の変更で登録順を変えない");
  assert.deepEqual(build("registered").groups[0].total[4], { sales: 100000, profit: 100000 });
  assert.deepEqual(build("registered").total[4], { sales: 200001, profit: 200001 });
  assert.deepEqual(build("registered").groups[2].total[4], { sales: 0, profit: 0 });
  assert.deepEqual(build("registered").groups[0].initiatives[1].months[5], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(build("registered").groups[0].initiatives[0].months[5], { sales: 0, expense: 0, profit: 0 });
  await assert.rejects(changeExpansionMaster(bytes, { type: "delete", id: 1 }), /使用/);
  const original = contents.initiatives[0];
  await assert.rejects(updateInitiative(bytes, original.id, 2026, { ...draft, expansionId: null }), /展開名/);
  const reassigned = await updateInitiative(bytes, original.id, 2026, { ...draft, rows: original.rows, expansionId: 8 });
  const after = await readPlanContents(reassigned);
  assert.equal(after.initiatives[0].expansionId, 8);
  assert.equal(buildExpansionTable(after, 2026, "registered").groups.find(item => item.expansion.id === 8).initiatives[0].id, original.id);
  assert.equal((await readPlanContents(bytes)).initiatives[0].expansionId, 1, "元ファイルを変更しない");
  const renamed = await changeExpansionMaster(reassigned, { type: "update", id: 8, expansionCode: "8", expansionName: "効率改善" });
  assert.equal(buildExpansionTable(await readPlanContents(renamed), 2026, "registered").groups.find(item => item.expansion.id === 8).expansion.expansionName, "効率改善");
  const database = await openTriadicDatabase(bytes);
  assert.throws(() => database.run("UPDATE initiatives SET expansion_id = 999 WHERE id = ?", [original.id]), /FOREIGN KEY/);
  database.close();
  const malformed = await openTriadicDatabase(bytes);
  malformed.exec("PRAGMA foreign_keys = OFF; UPDATE initiatives SET expansion_id = 999;");
  const invalid = malformed.export(); malformed.close();
  await assert.rejects(validateTriadicDatabase(invalid));
  const fractions = [100, 200, 300].map(amount => ({ months: { 4: { sales: amount, profit: amount } } }));
  const fractionalTable = buildExpansionTable({ ...contents, initiatives: fractions.map((item, id) => ({ ...item, id, fiscalYear: 2026, expansionId: 1 })) }, 2026, "registered");
  assert.equal(fractionalTable.total[4].profit, 600, "表示で丸めず1円精度で合算する");
  const overflow = { ...contents.initiatives[0], months: { 4: { sales: 9007199254740991, profit: 9007199254740991 } } };
  assert.throws(() => buildExpansionTable({ ...contents, initiatives: [overflow, { ...overflow, months: { 4: { sales: 1, profit: 1 } } }] }, 2026, "registered"), /範囲/);
  assert.deepEqual(api.totalInitiatives([{ months: { 4: { sales: null, profit: 1 } } }, { months: { 4: { sales: 2, profit: null } } }])[4], { sales: null, profit: null });
  assert.deepEqual(api.totalInitiatives([])[4], { sales: 0, profit: 0 });
  for (const sign of [1, -1]) {
    const tooLarge = [Number.MAX_SAFE_INTEGER, 1].map(value => ({ ...overflow, months: { 4: { sales: sign * value, profit: sign * value } } }));
    assert.throws(() => buildExpansionTable({ ...contents, initiatives: tooLarge }, 2026, "registered"), /範囲/);
  }
  const periodRows = [
    { id: 1, periodTypeId: 2, amount: 10 }, { id: 2, periodTypeId: null, amount: 20 },
    { id: 3, periodTypeId: 1, amount: 30 }, { id: 4, periodTypeId: 2, amount: 40 },
    { id: 5, amount: 50 },
  ];
  const snapshot = structuredClone(periodRows);
  const periods = [{ id: 1, periodName: "期間差" }, { id: 2, periodName: "新規" }, { id: 3, periodName: "未使用" }];
  const grouped = api.groupExpansionPeriods(periodRows, periods);
  assert.deepEqual(grouped.map(group => [group.name, group.initiatives.map(item => item.id)]), [["期間差", [3]], ["新規", [1, 4]], ["", [2, 5]]]);
  assert.deepEqual(api.groupExpansionPeriods(periodRows, [...periods].reverse()).map(group => group.id), [2, 1, null], "名称ではなく期間マスタ順");
  assert.equal(api.groupExpansionPeriods(periodRows, [{ ...periods[0], periodName: "名称変更" }, periods[1]])[0].name, "名称変更");
  assert.deepEqual(periodRows, snapshot, "表示順と金額を保存データへ反映しない");
  assert.deepEqual(api.groupExpansionPeriods([], periods), []);
  console.log("PASS: expansion assignment, grouped totals, sorting, year isolation, reassignment and deletion protection");
}
