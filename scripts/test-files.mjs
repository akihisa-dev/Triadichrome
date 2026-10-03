import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
      'export * from "./Triadichrome-extension/src/extension/BudgetWorkspace.tsx";',
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
    TriadicFileError, applyBudgetEdit, readBudgetData, writeTriadicFile, persistTriadicFile, BudgetWorkspace, monthsInPeriod } = await import(pathToFileURL(bundle));
  const bytes = await createTriadicDatabase();
  assert.deepEqual(monthsInPeriod("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthsInPeriod("0001-01", "0001-01"), ["0001-01"]);
  assert.deepEqual(monthsInPeriod("9999-12", "9999-12"), ["9999-12"]);
  for (const [start, end] of [["2026-13", "2027-01"], ["2027-01", "2026-01"], ["0000-01", "2026-01"]]) {
    assert.throws(() => monthsInPeriod(start, end));
  }
  const matrix = await openTriadicDatabase(bytes);
  applyBudgetEdit(matrix, { type: "period", start: "2026-11", end: "2027-02" });
  applyBudgetEdit(matrix, { type: "period", start: "2026-12", end: "2027-03" });
  assert.deepEqual(readBudgetData(matrix).months, ["2026-12", "2027-01", "2027-02", "2027-03"]);
  applyBudgetEdit(matrix, { type: "add", kind: "initiative", name: "施策" });
  applyBudgetEdit(matrix, { type: "add", kind: "account", name: "科目" });
  const cells = ["2026-12", "2027-01"].map(month => ({ line: { initiativeId: 1, accountId: 1, month, cost: 10.25, sales: 20.5, note: "月別計画" } }));
  const beforeBatch = readBudgetData(matrix);
  assert.throws(() => applyBudgetEdit(matrix, { type: "plans", edits: [cells[0], { line: { ...cells[1].line, cost: NaN } }] }));
  assert.deepEqual(readBudgetData(matrix), beforeBatch, "one invalid cell must roll back the whole sheet");
  applyBudgetEdit(matrix, { type: "plans", edits: cells });
  const matrixSaved = readBudgetData(matrix);
  assert.equal(matrixSaved.lines.length, 2);
  assert.equal(matrixSaved.lines.reduce((sum, line) => sum + line.cost, 0), 20.5);
  assert.throws(() => applyBudgetEdit(matrix, { type: "period", start: "2027-01", end: "2027-12" }), /入力済み/);
  assert.deepEqual(readBudgetData(matrix), matrixSaved, "a shorter period must not delete entered values");
  applyBudgetEdit(matrix, { type: "plans", edits: matrixSaved.lines.map(line => ({ id: line.id, line: { ...line, sales: 40 } })) });
  assert.equal(readBudgetData(matrix).lines.length, 2, "saving cells again must update rather than duplicate them");
  const matrixReloaded = await openTriadicDatabase(exportTriadicDatabase(matrix));
  assert.deepEqual(readBudgetData(matrixReloaded), readBudgetData(matrix));
  matrixReloaded.close(); matrix.close();
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
  assert.equal(readBudgetData(reopened).detail.values[0][7], "保持するメモ");
  assert.ok(readBudgetData(db).detail.columns.every((column) => !column.startsWith("actual_")));
  // Editing a legacy row must preserve hidden actual values.
  applyBudgetEdit(db, { type: "plan", id: 1, line: { initiativeId: 1, accountId: 1, month: "2026-09", cost: 100, sales: 250, note: "改訂" } });
  assert.deepEqual(db.exec("SELECT actual_amount, actual_sales_amount, actual_profit_amount FROM details WHERE id = 1")[0].values[0], [-50, 150, 200]);
  assert.throws(() => applyBudgetEdit(db, { type: "deletePlan", id: 1 }), /実績/);
  reopened.close(); db.close();

  const plan = await openTriadicDatabase(bytes);
  for (const name of ["施策A", "施策B"]) applyBudgetEdit(plan, { type: "add", kind: "initiative", name });
  for (const name of ["人件費", "仕入"]) applyBudgetEdit(plan, { type: "add", kind: "account", name });
  for (const month of ["2026-10", "2026-11"]) applyBudgetEdit(plan, { type: "month", month });
  const line = { initiativeId: 1, accountId: 1, month: "2026-10", cost: 1200, sales: 3000, note: "計画" };
  applyBudgetEdit(plan, { type: "plan", line });
  applyBudgetEdit(plan, { type: "plan", line: { ...line, accountId: 2, cost: 800, sales: 0 } });
  applyBudgetEdit(plan, { type: "plan", line: { ...line, initiativeId: 2, cost: 500, sales: 1000 } });
  let result = readBudgetData(plan);
  assert.deepEqual(result.expansion.values, [[2026, 10, "施策A", 2000, 3000, 1000], [2026, 10, "施策B", 500, 1000, 500]]);
  assert.deepEqual(result.cost.values, [[2026, 10, "人件費", 1700, 4000, 2300], [2026, 10, "仕入", 800, 0, -800]]);
  for (const invalid of [
    { type: "plan", line },
    { type: "plan", line: { ...line, cost: NaN } },
    { type: "plan", line: { ...line, sales: Infinity } },
    { type: "plan", line: { ...line, cost: 1e13 } },
    { type: "plan", line: { ...line, cost: 1.001 } },
    { type: "plan", line: { ...line, initiativeId: 999 } },
    { type: "plan", line: { ...line, accountId: 999 } },
    { type: "plan", line: { ...line, month: "2027-01" } },
    { type: "plan", id: 999, line },
    { type: "plan", id: 2, line },
    { type: "removeItem", kind: "initiative", id: 1 },
    { type: "removeItem", kind: "account", id: 1 },
    { type: "removeMonth", month: "2026-10" },
  ]) {
    assert.throws(() => applyBudgetEdit(plan, invalid));
    assert.deepEqual(readBudgetData(plan), result, "failed plan edits must preserve all data");
  }
  // Move, copy and delete a plan; all views and persisted data must follow.
  applyBudgetEdit(plan, { type: "plan", id: 1, line: { ...line, month: "2026-11", cost: 123.45, sales: 200, note: "翌月へ移動" } });
  applyBudgetEdit(plan, { type: "plan", line: { ...line, month: "2026-11", initiativeId: 2 } });
  applyBudgetEdit(plan, { type: "deletePlan", id: 2 });
  applyBudgetEdit(plan, { type: "removeItem", kind: "account", id: 2 });
  result = readBudgetData(plan);
  assert.equal(result.lines.length, 3);
  for (const view of [result.detail, result.cost, result.expansion]) {
    const costColumn = view.columns.indexOf("budget_amount");
    const salesColumn = view.columns.indexOf("budget_sales_amount");
    assert.equal(view.values.reduce((sum, row) => sum + row[costColumn], 0), 1823.45);
    assert.equal(view.values.reduce((sum, row) => sum + row[salesColumn], 0), 4200);
    assert.ok(view.columns.every((column) => !column.startsWith("actual_")));
  }
  const savedPlan = await openTriadicDatabase(exportTriadicDatabase(plan));
  assert.deepEqual(readBudgetData(savedPlan), result);
  for (const row of result.lines) applyBudgetEdit(plan, { type: "deletePlan", id: row.id });
  applyBudgetEdit(plan, { type: "removeMonth", month: "2026-10" });
  applyBudgetEdit(plan, { type: "removeItem", kind: "initiative", id: 1 });
  assert.equal(readBudgetData(plan).lines.length, 0);
  assert.deepEqual(readBudgetData(plan).months, ["2026-11"]);
  for (const section of ["initiative", "detail", "cost", "expansion"]) {
    const html = renderToStaticMarkup(createElement(BudgetWorkspace, {
      data: result, section, disabled: false, draftActive: false,
      onEdit: async () => true, onDraftChange: () => {},
    }));
    assert.doesNotMatch(html, /実績|actual_/);
    assert.doesNotMatch(html, /計画明細|予算名|明細を追加/);
    if (section === "initiative") {
      assert.match(html, /開始月/);
      assert.match(html, /終了月/);
      assert.match(html, /<th scope="col">2026\/10<\/th>/);
      assert.match(html, /<th scope="col">2026\/11<\/th>/);
      assert.match(html, /<th scope="row">人件費<\/th>/);
      assert.match(html, /施策A 人件費 2026-11 原価/);
      assert.match(html, /value="123.45"/);
    } else {
      assert.match(html, /1,823.45/);
      assert.match(html, /4,200/);
      assert.match(html, /2,376.55/);
    }
  }
  savedPlan.close(); plan.close();
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
  console.log("PASS: plan lifecycle, plan-only rendering, ordering, rollback, three-view totals, file round trip, legacy data preservation, write failures and conflicts");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
