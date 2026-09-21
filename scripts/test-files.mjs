import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "dist"), { recursive: true });
const temporary = await mkdtemp(join(root, "dist", ".file-tests-"));
try {
  const bundle = join(temporary, "tests.mjs");
  await build({
    stdin: { contents: [
      'export * from "./Triadichrome-extension/src/core/triadicDatabase.ts";',
      'export * from "./Triadichrome-extension/src/core/budgetData.ts";',
      'export * from "./Triadichrome-extension/src/extension/triadicFile.ts";',
    ].join("\n"), resolveDir: root },
    outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
    plugins: [{ name: "local-wasm", setup(api) {
      api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
      api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
        contents: `export default ${JSON.stringify(join(root, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
      }));
    } }],
  });
  const { createTriadicDatabase, openTriadicDatabase, exportTriadicDatabase,
    TriadicFileError, applyBudgetEdit, readBudgetData, writeTriadicFile, persistTriadicFile } = await import(pathToFileURL(bundle));
  const bytes = await createTriadicDatabase();
  const db = await openTriadicDatabase(bytes);
  applyBudgetEdit(db, { type: "name", name: "試験予算" });
  for (const name of ["施策A", "施策B", "施策C"]) applyBudgetEdit(db, { type: "add", kind: "initiative", name });
  applyBudgetEdit(db, { type: "add", kind: "account", name: "科目A" });
  applyBudgetEdit(db, { type: "month", month: "2026-09" });
  const initial = readBudgetData(db);
  assert.equal(initial.name, "試験予算");
  assert.deepEqual(initial.months, ["2026-09"]);
  assert.throws(() => applyBudgetEdit(db, { type: "add", kind: "initiative", name: "施策A" }), /同じ名前/);
  assert.throws(() => applyBudgetEdit(db, { type: "month", month: "2026-13" }), /年月/);
  assert.throws(() => applyBudgetEdit(db, { type: "month", month: "2026-09" }), /登録済み/);
  assert.throws(() => applyBudgetEdit(db, { type: "rename", kind: "account", id: 999, name: "不在" }), /見つかりません/);
  assert.deepEqual(readBudgetData(db), initial, "failed edits must roll back completely");
  applyBudgetEdit(db, { type: "move", kind: "initiative", id: 3, targetId: 1, after: false });
  assert.deepEqual(readBudgetData(db).initiatives.map((item) => item.id), [3, 1, 2]);
  applyBudgetEdit(db, { type: "move", kind: "initiative", id: 3, targetId: 2, after: true });
  assert.deepEqual(readBudgetData(db).initiatives.map((item) => item.id), [1, 2, 3]);
  db.run(`INSERT INTO details (budget_id, period_id, initiative_id, account_id, budget_amount,
    actual_amount, budget_sales_amount, actual_sales_amount, budget_profit_amount, actual_profit_amount, note)
    VALUES (1, 1, 1, 1, 123.45, -50, 200, 150, 76.55, 200, '保持するメモ')`);
  applyBudgetEdit(db, { type: "rename", kind: "initiative", id: 1, name: "名称変更後" });
  const exported = exportTriadicDatabase(db);
  assert.equal(db.exec("PRAGMA foreign_keys")[0].values[0][0], 1);
  const reopened = await openTriadicDatabase(exported);
  assert.deepEqual(readBudgetData(reopened), readBudgetData(db), "all three views survive round trip");
  assert.equal(readBudgetData(reopened).detail.values[0][2], "名称変更後");
  assert.equal(readBudgetData(reopened).detail.values[0][4], 123.45);
  assert.equal(readBudgetData(reopened).detail.values[0][10], "保持するメモ");
  reopened.close(); db.close();
  await assert.rejects(openTriadicDatabase(new Uint8Array([1, 2, 3])), TriadicFileError);
  for (const corrupt of [
    "DELETE FROM budgets",
    "PRAGMA foreign_keys = OFF; INSERT INTO periods (budget_id, year, month) VALUES (999, 2026, 9)",
  ]) {
    const invalid = await openTriadicDatabase(bytes);
    invalid.exec(corrupt);
    const invalidBytes = invalid.export(); invalid.close();
    await assert.rejects(openTriadicDatabase(invalidBytes), TriadicFileError);
  }
  function handle(failAt, abortFails = false) {
    const failure = new Error(failAt);
    const calls = [];
    let saved;
    return { failure, calls, get saved() { return saved; }, async createWritable() {
      if (failAt === "create") throw failure;
      return {
        async write(data) { calls.push("write"); if (failAt === "write") throw failure; saved = new Uint8Array(data); },
        async close() { calls.push("close"); if (failAt === "close") throw failure; },
        async abort() { calls.push("abort"); if (abortFails) throw new Error("abort"); },
      };
    } };
  }
  const success = handle();
  await writeTriadicFile(success, new Uint8Array([9, 8, 7, 6]).subarray(1, 3));
  assert.deepEqual(success.saved, new Uint8Array([8, 7]));
  assert.deepEqual(success.calls, ["write", "close"]);
  for (const stage of ["create", "write", "close"]) {
    const failed = handle(stage, true);
    await assert.rejects(writeTriadicFile(failed, bytes), (error) => error === failed.failure);
    if (stage !== "create") assert.equal(failed.calls.at(-1), "abort");
  }
  const conflict = handle();
  conflict.getFile = async () => new Blob([new Uint8Array([99])]);
  await assert.rejects(persistTriadicFile(conflict, bytes, new Uint8Array([10])), /変更されています/);
  assert.equal(conflict.calls.length, 0, "a changed file must never be overwritten");
  const verified = handle();
  verified.getFile = async () => new Blob([verified.saved ?? bytes]);
  await persistTriadicFile(verified, exported, bytes);
  assert.deepEqual(verified.saved, exported);
  const mismatch = handle();
  mismatch.getFile = async () => new Blob([new Uint8Array([99])]);
  await assert.rejects(persistTriadicFile(mismatch, bytes), /確認できません/);
  console.log("PASS: budget edits, ordering, rollback, three views, file round trip, invalid data, write failures and conflicts");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
