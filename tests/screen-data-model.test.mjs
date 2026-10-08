import assert from "node:assert/strict";
import { test } from "node:test";
import { withNodeBundle } from "../scripts/node-bundle.mjs";

test("画面とデータの対応が実際の保存テーブル・列・参照先と一致する", async () => {
  await withNodeBundle("tests/screen-data-api.ts", async ({ dataTables, screenData, createTriadicDatabase, openTriadicDatabase }) => {
    const database = await openTriadicDatabase(await createTriadicDatabase(2026));
    try {
      const tables = database.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'sqlite_sequence'")[0].values.map(([name]) => name);
      assert.deepEqual(dataTables.map(table => table.name).sort(), tables.sort(), "保存構造の表を漏れなく定義する");
      for (const table of dataTables) {
        const columns = database.exec(`PRAGMA table_info(${table.name})`)[0].values.map(row => row[1]);
        assert.deepEqual(table.columns.map(column => column.name).sort(), columns.sort(), `${table.name}の項目が一致する`);
        const references = database.exec(`PRAGMA foreign_key_list(${table.name})`)[0]?.values ?? [];
        assert.deepEqual(table.columns.filter(column => column.reference).map(column => `${column.name}:${column.reference}`).sort(),
          references.map(row => `${row[3]}:${row[2]}.${row[4]}`).sort(), `${table.name}の参照先が一致する`);
      }
      assert.equal(new Set(screenData.map(screen => screen.page)).size, screenData.length);
      for (const screen of screenData) {
        assert.equal(new Set(screen.tables.map(item => item.table)).size, screen.tables.length, `${screen.name}の表に重複がない`);
        for (const usage of screen.tables) {
          const table = dataTables.find(item => item.name === usage.table);
          assert.ok(table, `${screen.name}の保存テーブルが実在する`);
          for (const field of usage.fields) assert.ok(table.columns.some(column => column.name === field), `${usage.table}.${field}が実在する`);
        }
      }
      for (const page of ["initiative-list", "initiative-detail", "details", "cost-table", "expansion-table"]) {
        const screen = screenData.find(item => item.page === page);
        for (const name of ["initiative_rows", "initiative_amounts", "amount_overrides", "accounts"]) assert.ok(screen.tables.some(item => item.table === name));
        assert.ok(screen.calculated.some(text => text.includes("手修正の0")), "確定予算の0による手修正も説明する");
      }
      const list = screenData.find(item => item.page === "initiative-list");
      for (const name of ["expansions", "period_types"]) assert.ok(list.tables.some(item => item.table === name), "施策一覧の展開名と期間名の参照先を説明する");
      for (const field of ["expansion_id", "period_type_id"]) assert.ok(list.tables.find(item => item.table === "initiatives").fields.includes(field), "施策の分類への所属を説明する");
      assert.ok(!list.tables.some(item => ["aggregation_groups", "aggregation_members", "industries", "departments"].includes(item.table)), "施策一覧に表示しない分類や使わない集計を構成テーブルへ混ぜない");
      const kind = screenData.find(item => item.page === "kind-master");
      assert.deepEqual(kind.tables.map(item => item.table), ["plan"], "共通ヘッダーの年度だけを参照し、種別マスタの保存表を捏造しない");
      assert.ok(kind.calculated.some(text => text.includes("固定定義")));
    } finally { database.close(); }
  });
});
