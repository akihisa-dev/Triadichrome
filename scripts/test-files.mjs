import { verifyDetails } from "../tests/details.mjs";
import { verifyPeriodData } from "../tests/period-data.mjs";
import { verifyDepartmentData } from "../tests/department-data.mjs";
import { verifyExpansionTable } from "../tests/expansion-table.mjs";
import { verifyDefaultCostData } from "../tests/default-cost-data.mjs";
import { verifyIndustryData } from "../tests/industry-data.mjs";
import { verifyExpansionData } from "../tests/expansion-data.mjs";
import { verifyRecentFile } from "../tests/recent-file.mjs";
import { verifyAutoSave } from "../tests/auto-save.mjs";
import { verifyInitiativeData } from "../tests/initiative-data.mjs";
import { verifyAggregationData } from "../tests/aggregation-data.mjs";
import { verifySamplePlan } from "../tests/sample-plan.mjs";
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
      'export * from "./Triadichrome-extension/src/core/details.ts";',
      'export * from "./Triadichrome-extension/src/core/tableView.ts";',
      'export * from "./Triadichrome-extension/src/extension/detailFile.ts";',
      'export * from "./Triadichrome-extension/src/core/accountMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/expansionMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/periodMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/periodMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/departmentMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/departmentMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/industryMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/industryMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/expansionMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/initiatives.ts";',
      'export * from "./Triadichrome-extension/src/core/expansionTable.ts";',
      'export * from "./Triadichrome-extension/src/core/autoSave.ts";',
      'export * from "./Triadichrome-extension/src/core/aggregationMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/aggregationGraph.ts";',
      'export * from "./Triadichrome-extension/src/core/costTable.ts";',
      'export * from "./Triadichrome-extension/src/extension/aggregationMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/initiativeFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/accountMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/triadicFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/recentFile.ts";',
      'export * from "./tests/ui/sample-plan.ts";',
      'export * from "./tests/ui/empty-plan.ts";',
      'export * from "./Triadichrome-extension/src/core/amounts.ts";',
    ].join("\n"), resolveDir: root },
    outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
    plugins: [{ name: "local-wasm", setup(api) {
      api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
      api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
        contents: `export default ${JSON.stringify(join(root, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
      }));
    } }],
  });
  const productionApi = await import(pathToFileURL(bundle));
  await verifyDetails(productionApi);
  await verifyDefaultCostData(productionApi);
  await verifyExpansionTable(productionApi);
  // Empty-master fixtures keep CRUD regressions independent of new defaults.
  const api = { ...productionApi, createTriadicDatabase: productionApi.createCurrentEmptyTestPlan };
  const { createTriadicDatabase, validateTriadicDatabase, openTriadicDatabase, writeTriadicFile,
    readAccountMaster, changeAccountMaster, saveAccountMaster } = api;
  const bytes = await createTriadicDatabase();
  await validateTriadicDatabase(bytes);
  await assert.rejects(validateTriadicDatabase(new Uint8Array([1, 2, 3])));
  const database = await openTriadicDatabase(bytes);
  database.run("DELETE FROM budgets");
  const invalid = database.export(); database.close();
  await assert.rejects(validateTriadicDatabase(invalid));
  let saved;
  await writeTriadicFile({ async createWritable() { return {
    async write(value) { saved = value; }, async close() {}, async abort() {},
  }; } }, bytes);
  await validateTriadicDatabase(new Uint8Array(saved));
  for (const stage of ["write", "close"]) {
    let aborted = false;
    await assert.rejects(writeTriadicFile({ async createWritable() { return {
      async write() { if (stage === "write") throw new Error("write failure"); },
      async close() { if (stage === "close") throw new Error("close failure"); },
      async abort() { aborted = true; },
    }; } }, bytes));
    assert.equal(aborted, true);
  }
  console.log("PASS: .triadic creation, validation, write and failure cleanup");
  assert.deepEqual(await readAccountMaster(bytes), []);
  let master = await changeAccountMaster(bytes, { type: "add", accountType: "expense", accountCode: "100", accountName: " 売上高 " });
  const salesId = master.accounts[0].id;
  assert.equal(master.accounts[0].accountName, "売上高");
  assert.deepEqual(await readAccountMaster(bytes), [], "元のファイルを変更しない");
  await assert.rejects(changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "101", accountName: "売上高" }), /同じ名前/);
  await assert.rejects(changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "100", accountName: "別の科目" }), /同じ科目コード/);
  for (const accountCode of ["", "12", "1234", "1a3", "１２３", "-10", "1.0"]) {
    await assert.rejects(changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode, accountName: "無効なコード" }), /半角数字3桁/);
  }
  await assert.rejects(changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "501", accountName: " \n " }), /入力/);
  master = await changeAccountMaster(master.bytes, { type: "add", accountType: "expense", accountCode: "501", accountName: "消耗品費" });
  const suppliesId = master.accounts[1].id;
  await assert.rejects(changeAccountMaster(master.bytes, { type: "update", accountType: "expense", id: suppliesId, accountCode: "501", accountName: "売上高" }), /同じ名前/);
  master = await changeAccountMaster(master.bytes, { type: "update", accountType: "expense", id: salesId, accountCode: "100", accountName: "売上" });
  assert.equal(master.accounts[0].id, salesId, "名前の変更でも参照先が変わらない");
  const populated = await openTriadicDatabase(await api.asLegacyTestPlan(master.bytes));
  populated.run("INSERT INTO initiatives (id, budget_id, name) VALUES (1, 1, '検証施策')");
  populated.run("INSERT INTO periods (id, budget_id, year, month) VALUES (1, 1, 2026, 4)");
  populated.run("INSERT INTO details (budget_id, period_id, initiative_id, account_id, budget_amount) VALUES (1, 1, 1, ?, 123.5)", [salesId]);
  master.bytes = populated.export();
  populated.close();
  assert.equal((await readAccountMaster(master.bytes))[0].inUse, true);
  await assert.rejects(changeAccountMaster(master.bytes, { type: "delete", id: salesId }), /使用/);
  master = await changeAccountMaster(master.bytes, { type: "delete", id: suppliesId });
  assert.equal(master.accounts.length, 1);
  await assert.rejects(changeAccountMaster(master.bytes, { type: "update", accountType: "expense", id: suppliesId, accountCode: "502", accountName: "存在しない科目" }), /見つかりません/);
  const preserved = await openTriadicDatabase(await api.asLegacyTestPlan(master.bytes));
  assert.equal(preserved.exec("SELECT budget_amount FROM details")[0].values[0][0], 123.5);
  preserved.run("DROP INDEX accounts_code_idx");
  preserved.run("ALTER TABLE accounts DROP COLUMN code");
  const legacyBytes = preserved.export();
  preserved.close();
  const legacyAccounts = await readAccountMaster(legacyBytes);
  assert.equal(legacyAccounts[0].accountCode, null, "旧ファイルにコードを勝手に付与しない");
  const migrated = await changeAccountMaster(legacyBytes, { type: "update", accountType: "expense", id: salesId, accountCode: "001", accountName: "売上" });
  assert.equal((await readAccountMaster(migrated.bytes))[0].accountCode, "001", "先頭ゼロを保持する");
  const migratedDatabase = await openTriadicDatabase(migrated.bytes);
  assert.equal(migratedDatabase.exec("SELECT budget_amount FROM details")[0].values[0][0], 123.5);
  assert.throws(() => migratedDatabase.run("UPDATE accounts SET code = '12'"), /CHECK/);
  migratedDatabase.close();
  assert.equal((await readAccountMaster(legacyBytes))[0].accountCode, null, "移行時も元ファイルを変更しない");

  let stored = master.bytes;
  let writes = 0;
  const handle = {
    name: "plan.triadic",
    async getFile() { return new File([stored], this.name); },
    async createWritable() {
      let pending;
      return {
        async write(value) { pending = value; writes++; },
        async close() { stored = new Uint8Array(pending); },
        async abort() {},
      };
    },
  };
  const plan = { ...master, name: handle.name, handle };
  const noPicker = () => { throw new Error("既存のファイルを使用する"); };
  const savedPlan = await saveAccountMaster(plan, { type: "add", accountType: "expense", accountCode: "600", accountName: "給与手当" }, noPicker);
  assert.deepEqual(await readAccountMaster(stored), savedPlan.accounts, "保存後の再読込でマスタを復元できる");
  await assert.rejects(saveAccountMaster(plan, { type: "add", accountType: "expense", accountCode: "700", accountName: "競合" }, noPicker), /別の操作で更新/);
  assert.equal(writes, 1, "競合時は上書きしない");
  const previous = stored.slice();
  const failingHandle = { ...handle, async createWritable() { return {
    async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {},
  }; } };
  await assert.rejects(saveAccountMaster({ ...savedPlan, handle: failingHandle }, { type: "add", accountType: "expense", accountCode: "800", accountName: "未保存" }, noPicker), /保存失敗/);
  assert.deepEqual(stored, previous);
  assert.equal(savedPlan.accounts.some(account => account.accountName === "未保存"), false);
  const imported = { name: plan.name, bytes, accounts: [] };
  await assert.rejects(saveAccountMaster(imported, { type: "add", accountType: "expense", accountCode: "12", accountName: "無効な科目" }, noPicker), /半角数字3桁/);
  await assert.rejects(saveAccountMaster(imported, { type: "add", accountType: "expense", accountCode: "900", accountName: "キャンセル" }, async () => {
    throw new DOMException("キャンセル", "AbortError");
  }), { name: "AbortError" });
  assert.deepEqual(await readAccountMaster(imported.bytes), []);
  const savedImport = await saveAccountMaster(imported, { type: "add", accountType: "expense", accountCode: "001", accountName: "コピー" }, async () => handle);
  assert.equal(savedImport.accounts[0].accountName, "コピー");
  assert.equal(savedImport.handle, handle);
  console.log("PASS: account master CRUD, references, persistence, conflicts and failed/cancelled saves");
  await verifyPeriodData(productionApi);
  await verifyDepartmentData(productionApi);
  await verifyIndustryData(api);
  await verifyExpansionData(api);
  await verifyAutoSave(api);
  await verifyInitiativeData(api, root);
  await verifyAggregationData(api);
  await verifySamplePlan(productionApi);
  await verifyRecentFile(api);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
