import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { verifyPreviousWorkbookBoundary, verifyPreviousWorkbookProcessing } from "./previous-workbook-boundary.mjs";
import { verifyReportWorkbooks } from "./report-workbook.mjs";

async function roundtrip(wb) {
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer()); return loaded;
}
export async function verifySpreadsheetIO(api) {
  const bytes = await api.createSamplePlan(2026), plan = await api.readPlanContents(bytes);
  const pairsForIndex = plan.industries.slice(0, 2).flatMap(i => plan.departments.map(d => ({ industryId: i.id, departmentId: d.id })));
  const sparse = { ...plan, previousAmounts: pairsForIndex.flatMap((pair, i) => plan.accounts.slice(0, 2).map((a, n) => ({ ...pair, accountId: a.id, month: 4, amount: String(i * 10 + n) + ".001", id: i * 2 + n, revision: 0 }))) };
  sparse.previousAmounts.find = () => { throw new Error("前年金額の繰り返し全件検索は禁止"); };
  const indexed = api.createPreviousWorkbook(sparse, pairsForIndex);
  indexed.worksheets.filter(ws => ws.state === "visible").forEach((ws, i) => {
    assert.equal(ws.getCell("C4").value, i * 10 + 0.001);
    assert.equal(ws.getCell("D4").value, 0, "欠損月は0");
  });
  assert.deepEqual(api.readPreviousWorkbook(indexed, sparse), []);
  indexed.worksheets[0].getCell("C4").value = null;
  indexed.worksheets[0].getCell("C5").value = 0;
  const indexedPatches = api.readPreviousWorkbook(indexed, sparse);
  assert.equal(indexedPatches.length, 1); assert.equal(indexedPatches[0].before, "1.001"); assert.equal(indexedPatches[0].after, "0");
  await verifyPreviousWorkbookBoundary(api, plan);
  await verifyPreviousWorkbookProcessing();
  await verifyReportWorkbooks(api, plan);
  const pairs = [{ industryId: plan.industries[0].id, departmentId: plan.departments[0].id }, { industryId: plan.industries[1].id, departmentId: plan.departments[1].id }];
  // #15: real XLSX round trips must preserve every yen, including Excel's 15-digit boundary.
  const boundaryAmounts = ["9007199254740.991", "-9007199254740.991", "9007199254740.99", "-9007199254740.99", "1000000000000.001", "-1000000000000.001", "999999999999.999", "123.456", "-123.456", "0", "9007199254740", "0.001"];
  const precise = { ...plan, previousAmounts: boundaryAmounts.map((amount, index) => ({ ...pairs[0], accountId: plan.accounts[0].id, month: [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3][index], amount })) };
  const preciseBefore = structuredClone(precise);
  const output = await api.serializeWorkbook(api.createPreviousWorkbook(precise, [pairs[0]]));
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(output);
  const amountsSheet = loaded.worksheets[0];
  boundaryAmounts.forEach((amount, index) => {
    const cell = amountsSheet.getCell(4, index + 3);
    assert.equal(api.amountToYen(String(cell.value)), api.amountToYen(amount));
    if ([0, 1, 4, 5].includes(index)) {
      assert.equal(typeof cell.value, "string"); assert.equal(cell.numFmt, "@");
    }
  });
  assert.equal(typeof amountsSheet.getCell("J4").value, "number", "通常額は数値として出力");
  assert.deepEqual(await api.parsePreviousWorkbook(output, precise), [], "無編集の再取り込みは変更なし");
  amountsSheet.getCell("C4").value = "9007199254740.990";
  amountsSheet.getCell("D4").value = "-9007199254740.990";
  amountsSheet.getCell("J4").value = 123.457;
  const edited = await api.parsePreviousWorkbook(await api.serializeWorkbook(loaded), precise);
  assert.deepEqual(edited.map(p => [p.month, p.after]), [[4, "9007199254740.99"], [5, "-9007199254740.99"], [11, "123.457"]]);
  amountsSheet.getCell("C4").value = "9007199254740.992";
  await assert.rejects(api.parsePreviousWorkbook(await api.serializeWorkbook(loaded), precise), /千円単位/);
  assert.deepEqual(precise, preciseBefore, "出力・読込・失敗で元の計画を変更しない");
  // #13: sanitize the output name after truncation without modifying masters.
  for (const departmentName of ["検証", "検証'", "部".repeat(26) + "'続き", "O'Brien", "検証/部署"]) {
    const input = { ...plan, industries: plan.industries.map((item, index) => index === 0 ? { ...item, industryName: "業" } : item),
      departments: plan.departments.map((item, index) => index === 0 ? { ...item, departmentName } : item) };
    const original = structuredClone(input);
    const output = await api.serializeWorkbook(api.createPreviousWorkbook(input, pairs));
    const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(output);
    const ws = loaded.worksheets[0];
    assert.ok(ws.name.length <= 31);
    assert.doesNotMatch(ws.name, /^'|'$/);
    if (departmentName === "検証") assert.equal(ws.name, "1_業_検証");
    assert.equal(loaded.getWorksheet("_triadichrome").getCell("A3").value, ws.name);
    assert.deepEqual(await api.parsePreviousWorkbook(output, input), []);
    ws.getCell("C4").value = 123.456;
    const imported = await api.parsePreviousWorkbook(await api.serializeWorkbook(loaded), input);
    assert.equal(imported.length, 1);
    assert.equal(imported[0].departmentId, pairs[0].departmentId);
    assert.equal(imported[0].after, "123.456");
    assert.deepEqual(input, original, "出力用シート名だけを整え、マスタ名を変更しない");
  }
  const template = await roundtrip(api.createPreviousWorkbook(plan, pairs));
  assert.equal(template.worksheets.length, 3);
  assert.equal(template.getWorksheet("_triadichrome").state, "veryHidden");
  assert.deepEqual(api.readPreviousWorkbook(template, plan), []);
  const first = template.worksheets[0];
  const originalAmount = first.getCell("C4").value;
  first.getCell("C4").value = null; first.getCell("D4").value = 0; first.getCell("E4").value = -123.456;
  const patches = api.readPreviousWorkbook(template, plan);
  assert.equal(patches.length, 2); assert.ok(!patches.some(p => p.month === 4));
  assert.ok(patches.some(p => p.month === 5 && p.after === "0"));
  assert.ok(patches.some(p => p.month === 6 && p.after === "-123.456"));
  assert.deepEqual(await api.parsePreviousWorkbook(await api.serializeWorkbook(template), plan), patches);
  const updated = await api.changePlanSettings(bytes, { type: "previous-import", patches });
  const saved = await api.readPlanContents(updated);
  assert.equal(saved.previousAmounts.find(p => p.industryId === pairs[0].industryId && p.departmentId === pairs[0].departmentId && p.accountId === plan.accounts[0].id && p.month === 4).amount, String(originalAmount));
  assert.equal(saved.previousAmounts.find(p => p.industryId === pairs[0].industryId && p.departmentId === pairs[0].departmentId && p.accountId === plan.accounts[0].id && p.month === 6).amount, "-123.456");
  await assert.rejects(api.changePlanSettings(bytes, { type: "previous-import", patches: [...patches, { ...patches[0], accountId: -1 }] }), /マスタ/);
  assert.deepEqual(await api.readPlanContents(bytes), plan, "一部の失敗で元のデータを書き換えない");
  await assert.rejects(api.changePlanSettings(updated, { type: "previous-import", patches }), /変更/);
  for (const bad of [0.0001, "abc", { formula: "1+1", result: 2 }, { error: "#VALUE!" }]) {
    first.getCell("E4").value = bad; assert.throws(() => api.readPreviousWorkbook(template, plan));
  }
  first.getCell("E4").value = -123.456;
  assert.throws(() => api.readPreviousWorkbook(template, { ...plan, fiscalYear: 2027 }), /年度/);
  first.getCell("A4").value = "changed"; assert.throws(() => api.readPreviousWorkbook(template, plan), /科目/);
  assert.throws(() => api.createPreviousWorkbook(plan, [pairs[0], pairs[0]]));
  await assert.rejects(api.parsePreviousWorkbook(new Uint8Array([1, 2, 3]), plan), /読み込めません/);
  // #22: even same-ID/same-name recreation is distinct; rename remains the same classification.
  const fresh = await api.createTriadicDatabase(2026);
  const initial = await api.readPlanContents(fresh);
  const pair = { industryId: 9, departmentId: 2 };
  const oldBook = await roundtrip(api.createPreviousWorkbook(initial, [pair]));
  oldBook.worksheets[0].getCell('C4').value = 1.125;
  const oldBytes = await api.serializeWorkbook(oldBook);
  const confirmed = await api.parsePreviousWorkbook(oldBytes, initial);
  for (const kind of ['department', 'industry']) for (const sameName of [false, true]) {
    const original = kind === 'department' ? initial.departments.find(x => x.id === 2) : initial.industries.find(x => x.id === 9);
    const change = kind === 'department' ? api.changeDepartmentMaster : api.changeIndustryMaster;
    let replaced = await change(fresh, { type: 'delete', id: original.id });
    replaced = await change(replaced, kind === 'department' ? { type: 'add', departmentName: sameName ? original.departmentName : '新部署' } :
      { type: 'add', industryCode: original.industryCode, industryName: sameName ? original.industryName : '新業種' });
    const current = await api.readPlanContents(replaced);
    const recreated = (kind === 'department' ? current.departments : current.industries).find(x => x.id === original.id);
    assert.ok(recreated, 'SQLiteによる番号再利用を実データで再現');
    assert.notEqual(recreated.identity, original.identity);
    await assert.rejects(api.parsePreviousWorkbook(oldBytes, current), /作り直/);
    await assert.rejects(api.changePlanSettings(replaced, { type: 'previous-import', patches: confirmed }), /作り直/);
    assert.deepEqual(await api.readPlanContents(replaced), current, '拒否時に金額を更新しない');
    const newBook = api.createPreviousWorkbook(current, [pair]); newBook.worksheets[0].getCell('C4').value = -0.001;
    const accepted = await api.parsePreviousWorkbook(await api.serializeWorkbook(newBook), current);
    assert.equal(accepted[0].after, '-0.001');
    await api.changePlanSettings(replaced, { type: 'previous-import', patches: accepted });
    const snapshot = await api.createBusinessSnapshot(replaced);
    const renamedNew = await change(replaced, kind === 'department' ? { type: 'update', id: original.id, departmentName: '改名後' } :
      { type: 'update', id: original.id, industryCode: original.industryCode, industryName: '改名後' });
    const restored = await api.applyOperationSnapshot(renamedNew, snapshot);
    assert.deepEqual(await api.readPlanContents(restored), current, '取消で作成識別子も元の分類へ戻る');
  }
  let renamed = await api.changeDepartmentMaster(fresh, { type: 'update', id: 2, departmentName: '改名部署' });
  renamed = await api.changeIndustryMaster(renamed, { type: 'update', id: 9, industryCode: '99', industryName: '改名業種' });
  const renamedPlan = await api.readPlanContents(renamed);
  assert.deepEqual(await api.parsePreviousWorkbook(oldBytes, renamedPlan), confirmed, '改名は同じ分類として取り込める');
  await api.changePlanSettings(renamed, { type: 'previous-import', patches: confirmed });
  oldBook.getWorksheet('_triadichrome').getCell('A1').value = 'Triadichrome previous v1';
  await assert.rejects(api.parsePreviousWorkbook(await api.serializeWorkbook(oldBook), initial), /出力し直し/);
  console.log("spreadsheet io ok: all selections, formulas, styles, precision, import and atomic failure");
}
