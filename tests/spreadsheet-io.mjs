import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { verifyReportWorkbooks } from "./report-workbook.mjs";

async function roundtrip(wb) {
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer()); return loaded;
}
export async function verifySpreadsheetIO(api) {
  const bytes = await api.createSamplePlan(2026), plan = await api.readPlanContents(bytes);
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
  console.log("spreadsheet io ok: all selections, formulas, styles, precision, import and atomic failure");
}
