import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import initSqlJs from "sql.js";

export async function verifyInitiativeData(api, root) {
  const { createTriadicDatabase, changeAccountMaster, readPlanContents, registerInitiative, saveInitiative, openTriadicDatabase, validateTriadicDatabase } = api;
  let bytes = await createTriadicDatabase();
  for (const [index, accountType] of ["sales", "cost", "expense", "profit"].entries()) {
    bytes = (await changeAccountMaster(bytes, { type: "add", accountCode: String(100 + index), accountName: accountType, accountType })).bytes;
  }
  const initial = await readPlanContents(bytes);
  assert.deepEqual(initial.accounts.map(item => item.accountType), ["sales", "cost", "expense", "profit"]);
  await assert.rejects(changeAccountMaster(bytes, { type: "add", accountCode: "200", accountName: "属性なし", accountType: "" }), /科目属性/);
  await assert.rejects(changeAccountMaster(bytes, { type: "add", accountCode: "200", accountName: "属性不正", accountType: "other" }), /科目属性/);
  const draft = {
    name: " 登録する施策 ", note: "備考を保持", expansionId: 1, industryId: initial.industries[0].id, departmentId: initial.departments[0].id, fiscalYear: "2026",
    rows: [
      { accountId: initial.accounts[0].id, amounts: { 4: "100", 5: "0", 3: "1.25" } },
      { accountId: initial.accounts[0].id, amounts: { 4: "25.5", 3: "-0.25" } },
      { accountId: initial.accounts[1].id, amounts: { 4: "30" } },
      { accountId: initial.accounts[2].id, amounts: { 4: "20", 6: "-5.5" } },
      { accountId: initial.accounts[3].id, amounts: { 4: "10" } },
      { accountId: initial.accounts[3].id, amounts: {} },
      { accountId: null, amounts: {} },
    ],
  };
  const result = await registerInitiative(bytes, draft);
  const contents = await readPlanContents(result);
  const record = contents.initiatives[0];
  assert.equal(record.name, "登録する施策");
  assert.equal(record.note, draft.note);
  assert.equal(record.fiscalYear, 2026);
  assert.equal(record.rows.length, 6, "同一科目と全月空欄の行を個別に保持");
  assert.equal(Object.keys(record.rows[0].amounts).length, 12);
  assert.equal(record.rows[0].amounts[3], "1.25");
  assert.equal(record.rows[0].amounts[4], "100");
  assert.equal(record.rows[1].amounts[3], "-0.25");
  assert.equal(record.rows[1].amounts[4], "25.5");
  assert.deepEqual(record.months[4], { sales: 95.5, expense: 20, profit: 85.5 });
  assert.deepEqual(record.months[5], { sales: 0, expense: 0, profit: 0 });
  assert.deepEqual(record.months[7], { sales: 0, expense: 0, profit: 0 }, "未入力月はゼロとして保持");
  assert.deepEqual(record.months[6], { sales: 0, expense: -5.5, profit: 5.5 }, "負の費用は利益に正の影響");
  assert.deepEqual(record.months[3], { sales: 1, expense: 0, profit: 1 });
  assert.equal((await readPlanContents(bytes)).initiatives.length, 0, "入力データの元ファイルを変更しない");
  for (const year of ["", "0", "2026.5", "9999", "NaN"]) await assert.rejects(registerInitiative(bytes, { ...draft, fiscalYear: year }), /年度/);
  for (const amount of ["Infinity", "NaN", " "]) await assert.rejects(registerInitiative(bytes, { ...draft, rows: [{ accountId: initial.accounts[0].id, amounts: { 4: amount } }] }), /有効な金額/);
  await assert.rejects(registerInitiative(result, draft), /同じ施策名/);
  await assert.rejects(registerInitiative(bytes, { ...draft, rows: [{ accountId: null, amounts: {} }] }), /勘定科目/);
  await assert.rejects(changeAccountMaster(result, { type: "delete", id: initial.accounts[3].id }), /使用/);
  const database = await openTriadicDatabase(result);
  assert.deepEqual(database.exec("SELECT year, month FROM periods ORDER BY year, month")[0].values,
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(month => [month < 4 ? 2027 : 2026, month]));
  const detailSum = database.exec("SELECT SUM(budget_sales_amount), SUM(budget_profit_amount) FROM detail_view WHERE month = 4")[0].values[0];
  const costSum = database.exec("SELECT SUM(budget_sales_amount), SUM(budget_profit_amount) FROM cost_view WHERE month = 4")[0].values[0];
  assert.deepEqual(detailSum, [95.5, 85.5]);
  assert.deepEqual(costSum, detailSum, "各ビューは同じ明細を集計");
  database.close();
  const reclassified = await changeAccountMaster(result, { type: "update", id: initial.accounts[2].id, accountCode: "102", accountName: "expense", accountType: "profit" });
  assert.deepEqual((await readPlanContents(reclassified.bytes)).initiatives[0].months[4], { sales: 95.5, expense: 0, profit: 125.5 });
  await assert.rejects(registerInitiative(result, { ...draft, name: "別年度の施策", fiscalYear: "2027" }), /基準年度/);

  let stored = bytes;
  let writes = 0;
  const handle = { name: "test.triadic", async getFile() { return new File([stored], this.name); }, async createWritable() {
    let pending;
    return { async write(value) { pending = value; writes++; }, async close() { stored = new Uint8Array(pending); }, async abort() {} };
  } };
  const plan = { ...initial, name: handle.name, bytes, handle };
  const noPicker = () => { throw new Error("保存先を再選択しない"); };
  const saved = await saveInitiative(plan, draft, noPicker);
  assert.deepEqual((await readPlanContents(stored)).initiatives, saved.initiatives);
  await assert.rejects(saveInitiative(plan, draft, noPicker), /別の操作で更新/);
  assert.equal(writes, 1);
  const beforeFailure = stored.slice();
  const failedDraft = { ...draft, name: "失敗する施策" };
  const failedHandle = { ...handle, async createWritable() { return { async write() { throw new Error("保存失敗"); }, async close() {}, async abort() {} }; } };
  await assert.rejects(saveInitiative({ ...saved, handle: failedHandle }, failedDraft, noPicker), /保存失敗/);
  assert.deepEqual(stored, beforeFailure);
  assert.equal(saved.initiatives.length, 1);
  await assert.rejects(saveInitiative({ ...initial, bytes, name: handle.name }, draft, async () => { throw new DOMException("キャンセル", "AbortError"); }), { name: "AbortError" });
  assert.equal(draft.rows[0].amounts[4], "100");
  assert.equal((await readPlanContents(bytes)).initiatives.length, 0);

  const sql = await initSqlJs();
  const legacy = new sql.Database();
  legacy.exec(await readFile(join(root, "tests/fixtures/triadic-v1.sql"), "utf8"));
  legacy.exec(`INSERT INTO budgets (id, created_at, updated_at) VALUES (1, 'old', 'old');
    INSERT INTO accounts (id, budget_id, code, name) VALUES (1, 1, '001', '旧科目');
    INSERT INTO initiatives (id, budget_id, name) VALUES (1, 1, '旧施策');
    INSERT INTO periods (id, budget_id, year, month) VALUES (1, 1, 2025, 4);
    INSERT INTO details (id, budget_id, period_id, initiative_id, account_id, budget_amount, actual_amount, note) VALUES (1, 1, 1, 1, 1, 123.5, 7, '旧備考');`);
  const legacyBytes = legacy.export();
  legacy.close();
  await assert.rejects(readPlanContents(legacyBytes), /対応していません/);
  console.log("PASS: initiative registration, attributes, fiscal periods, aggregates, duplicate rows, unsupported formats and save failures");
}
