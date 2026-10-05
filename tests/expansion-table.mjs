import assert from "node:assert/strict";

export async function verifyExpansionTable(api) {
  const { createTriadicDatabase, registerInitiative, updateInitiative, readPlanContents, changeExpansionMaster,
    buildExpansionTable, createInitiativeDraft, openTriadicDatabase, validateTriadicDatabase } = api;
  let bytes = await createTriadicDatabase();
  const initial = await readPlanContents(bytes);
  const accountId = initial.accounts.find(item => item.accountType === "sales").id;
  const draft = { ...createInitiativeDraft("2026"), name: "施策B", rows: [{ accountId, amounts: { 4: "100.001", 5: "0" } }] };
  assert.equal(draft.expansionId, null);
  await assert.rejects(registerInitiative(bytes, draft), /展開名/);
  await assert.rejects(registerInitiative(bytes, { ...draft, expansionId: 999 }), /展開名/);
  bytes = await registerInitiative(bytes, { ...draft, expansionId: 1 });
  bytes = await registerInitiative(bytes, { ...draft, name: "施策A", expansionId: 1, rows: [{ accountId, amounts: { 4: "-0.001" } }] });
  bytes = await registerInitiative(bytes, { ...draft, name: "別展開", expansionId: 2 });
  bytes = await registerInitiative(bytes, { ...draft, name: "別年度", expansionId: 1, fiscalYear: "2025" });
  const contents = await readPlanContents(bytes);
  const build = sort => buildExpansionTable(contents, 2026, sort);
  assert.equal(build("registered").groups.length, 7);
  assert.deepEqual(build("registered").groups.map(item => item.expansion.expansionCode), ["1", "2", "3", "4", "5", "8", "9"]);
  assert.deepEqual(build("registered").groups[0].initiatives.map(item => item.name), ["施策B", "施策A"]);
  assert.deepEqual(build("asc").groups[0].initiatives.map(item => item.name), ["施策A", "施策B"]);
  assert.deepEqual(build("desc").groups[0].initiatives.map(item => item.name), ["施策B", "施策A"]);
  assert.deepEqual(contents.initiatives.slice(0, 2).map(item => item.name), ["施策B", "施策A"], "表示順の変更で登録順を変えない");
  assert.deepEqual(build("registered").groups[0].total[4], { sales: 100, profit: 100 });
  assert.deepEqual(build("registered").total[4], { sales: 200.001, profit: 200.001 });
  assert.deepEqual(build("registered").groups[2].total[4], { sales: 0, profit: 0 });
  assert.equal(build("registered").groups[0].initiatives[1].months[5], undefined);
  assert.deepEqual(build("registered").groups[0].initiatives[0].months[5], { sales: 0, profit: 0 });
  await assert.rejects(changeExpansionMaster(bytes, { type: "delete", id: 1 }), /使用/);
  const original = contents.initiatives[0];
  await assert.rejects(updateInitiative(bytes, original.id, 2026, { ...draft, expansionId: null }), /展開名/);
  const reassigned = await updateInitiative(bytes, original.id, 2026, { ...draft, expansionId: 8 });
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
  console.log("PASS: expansion assignment, grouped totals, sorting, year isolation, reassignment and deletion protection");
}
