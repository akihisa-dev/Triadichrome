import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { describeSchema, screenImplementations, staleScreens } from "../scripts/data-map.mjs";
import { withNodeBundle } from "../scripts/node-bundle.mjs";
import { projectRoot } from "../scripts/paths.mjs";

test("保存項目の追加・削除・参照先変更を説明用の表へ自動反映する", async () => {
  const SQL = await withNodeBundle("Triadichrome-extension/src/core/storage/sqliteRuntime.ts", ({ initializeSqlite }) => initializeSqlite());
  const database = new SQL.Database();
  try {
    database.run("CREATE TABLE owners (id INTEGER PRIMARY KEY); CREATE TABLE children (owner_id INTEGER REFERENCES owners(id), obsolete TEXT);");
    database.run("ALTER TABLE children DROP COLUMN obsolete; ALTER TABLE children ADD COLUMN new_amount INTEGER; CREATE TABLE newer (child_id INTEGER REFERENCES children(new_amount));");
    const schema = describeSchema(database);
    assert.deepEqual(schema.find(table => table.name === "children").columns, [{ name: "owner_id", reference: "owners.id" }, { name: "new_amount" }]);
    await withNodeBundle("Triadichrome-extension/src/core/storage/dataMapDescription.ts", ({ describeDataTables }) => {
      const described = describeDataTables(schema, {}, {});
      assert.equal(described.find(table => table.name === "newer").columns[0].reference, "children.new_amount");
      assert.equal(described.find(table => table.name === "children").columns[1].label, "new_amount", "新しい項目は日本語名の登録前でも表示する");
      assert.ok(!described.find(table => table.name === "children").columns.some(column => column.name === "obsolete"));
    });
  } finally { database.close(); }
});

test("画面・計算・接続・対応説明の変更と画面の追加漏れを検出する", async () => {
  const read = file => readFile(path.join(projectRoot, file), "utf8");
  const implementations = await screenImplementations(read);
  const review = JSON.parse(await read("Triadichrome-extension/src/extension/screenDataReview.json"));
  await withNodeBundle("Triadichrome-extension/src/extension/screenDataModel.ts", async ({ screenData }) => {
    assert.deepEqual(staleScreens(review, implementations, screenData), []);
    const changed = await screenImplementations(async file => {
      const text = await read(file);
      return file.endsWith("/InitiativeListPage.tsx") ? text.replace("item.name}</button>", "item.note}</button>") : text;
    });
    assert.ok(staleScreens(review, changed, screenData).includes("initiative-list"), "画面の表示元変更を検出する");
    const calculation = await screenImplementations(async file => {
      const text = await read(file);
      return file.endsWith("/kinds.ts") ? text.replace("if (kind === 1)", "if (kind === 2)") : text;
    });
    assert.ok(staleScreens(review, calculation, screenData).includes("initiative-list"), "間接的に使う計算規則の変更も検出する");
    const wiring = await screenImplementations(async file => {
      const text = await read(file);
      return file.endsWith("/HomePage.tsx") ? text.replace("contents.kindSelections[", "currentContents.kindSelections[") : text;
    });
    assert.ok(staleScreens(review, wiring, screenData).includes("initiative-list"), "親画面から渡す表示元の変更も検出する");
    assert.ok(staleScreens(review, { ...implementations, "new-screen": "new-source" }, screenData).includes("new-screen"));
    assert.ok(staleScreens(review, implementations, screenData.filter(screen => screen.page !== "details")).includes("details"));
    const descriptions = screenData.map(screen => screen.page === "initiative-list" ? { ...screen, calculated: ["新しい説明"] } : screen);
    assert.ok(staleScreens(review, implementations, descriptions).includes("initiative-list"));
  });
});
