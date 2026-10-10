import assert from "node:assert/strict";

export async function verifySchemaBoundary(api) {
  const original = await api.createTriadicDatabase(2026);
  const initial = await api.readPlanContents(original);
  const snapshot = await api.createBusinessSnapshot(original);
  // Harmless fixture alterations exercise executable schema objects and same-name replacements.
  const alterations = [
    "CREATE TRIGGER unexpected_update AFTER UPDATE OF updated_at ON document_info BEGIN UPDATE departments SET name = '人工の変更' WHERE id = 1; END",
    "DROP TRIGGER immutable_fiscal_year; CREATE TRIGGER immutable_fiscal_year BEFORE UPDATE OF fiscal_year ON document_info BEGIN SELECT 1; END",
    "CREATE VIEW unexpected_view AS SELECT id FROM accounts",
    "CREATE INDEX unexpected_expression ON accounts(lower(name))",
    "CREATE TABLE unexpected_table (value TEXT)",
    "ALTER TABLE accounts ADD COLUMN extra TEXT GENERATED ALWAYS AS (name) VIRTUAL",
  ];
  for (const bytes of [original, snapshot]) for (const sql of alterations) {
    const db = await (bytes === original ? api.openTriadicDatabase(bytes) : api.openBusinessSnapshot(bytes));
    db.exec(sql);
    const altered = db.export(); db.close();
    await assert.rejects(bytes === original ? api.openTriadicDatabase(altered) : api.openBusinessSnapshot(altered), /許可されていない保存構造/);
    if (bytes === original) {
      await assert.rejects(api.editDatabase(altered, () => {}), /許可されていない保存構造/);
      await assert.rejects(api.createBusinessSnapshot(altered), /許可されていない保存構造/);
    } else {
      await assert.rejects(api.applyOperationSnapshot(original, altered), /許可されていない保存構造/);
      const container = await api.openTriadicDatabase(original);
      const now = new Date().toISOString();
      container.run("INSERT INTO data_history VALUES (1, ?, ?)", [now, altered]);
      container.run("UPDATE data_history_state SET next_id = 2");
      const historic = api.exportTriadicDatabase(container); container.close();
      await assert.rejects(api.readHistorySnapshot(historic, 1), /許可されていない保存構造/);
      await assert.rejects(api.restoreDataHistory(historic, 1, now), /許可されていない保存構造/);
    }
  }
  // A view substituted for a required table must be rejected before any business SELECT.
  const replaced = await api.openTriadicDatabase(original);
  replaced.exec("ALTER TABLE triadic_metadata RENAME TO displaced_metadata; CREATE VIEW triadic_metadata AS SELECT * FROM displaced_metadata");
  const changed = replaced.export(); replaced.close();
  await assert.rejects(api.openTriadicDatabase(changed), /許可されていない保存構造/);
  const live = await api.openTriadicDatabase(original);
  assert.throws(() => live.exec("UPDATE document_info SET fiscal_year = 2027"), /年度は作成時に固定/);
  live.exec("CREATE TEMP TRIGGER unexpected_temporary AFTER UPDATE ON document_info BEGIN SELECT 1; END");
  assert.throws(() => api.exportTriadicDatabase(live), /許可されていない保存構造/);
  live.close();
  const ordinary = await api.editDatabase(original, db => db.run("UPDATE departments SET name = '正常の変更' WHERE id = 1"));
  assert.equal((await api.readPlanContents(ordinary.bytes)).departments[0].departmentName, "正常の変更");
  assert.deepEqual(await api.readPlanContents(original), initial, "拒否と編集は元の計画を書き換えない");
  console.log("PASS: exact plan/snapshot schema, altered trigger/view/index/table, history/undo refusal, immutable year and ordinary edit");
}
