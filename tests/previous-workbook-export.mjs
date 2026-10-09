import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export async function verifyPreviousWorkbookExport(api) {
  const plan = await api.readPlanContents(await api.createPreviousExportPlan());
  const pairs = plan.industries.flatMap(i => plan.departments.map(d => ({ industryId: i.id, departmentId: d.id })));
  assert.equal(plan.accounts.length, 330); assert.equal(pairs.length, 18);
  const before = structuredClone(plan);
  const prototype = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx), write = prototype.writeBuffer;
  let writes = 0;
  prototype.writeBuffer = function (...args) { writes++; return write.apply(this, args); };
  try {
    await assert.rejects(api.createPreviousWorkbookBytes(plan, pairs), /上限.*組み合わせを減らし.*別ファイル/);
    assert.equal(writes, 0, "上限超過はExcelJSの出力処理より前に拒否");
  } finally { prototype.writeBuffer = write; }
  assert.throws(() => api.createPreviousWorkbook({ ...plan, accounts: plan.accounts.slice(0, 326) }, pairs), /取り込み上限/);
  const below = { ...plan, accounts: plan.accounts.slice(0, 325) };
  const boundary = await api.createPreviousWorkbookBytes(below, pairs);
  const zip = await JSZip.loadAsync(boundary);
  let cells = 0;
  for (const entry of Object.values(zip.files).filter(f => /^xl\/worksheets\/[^/]+\.xml$/.test(f.name))) cells += ((await entry.async("string")).match(/<c\b/g) ?? []).length;
  assert.equal(cells, 199642, "見出しと書式付き空欄を含む実際のセル数");
  assert.deepEqual(await api.parsePreviousWorkbook(boundary, below), [], "上限直前の出力を無編集で読み戻せる");
  const output = await api.createPreviousWorkbookBytes(plan, pairs.slice(0, 17));
  assert.deepEqual(await api.parsePreviousWorkbook(output, plan), [], "選択を減らした330科目の出力を読み戻せる");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(output);
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("C4").value, 123.456); assert.equal(ws.getCell("D4").value, 0);
  ws.getCell("C4").value = null;
  assert.deepEqual(await api.parsePreviousWorkbook(await api.serializeWorkbook(wb), plan), [], "空欄は既存額を保持");
  ws.getCell("C4").value = 0; ws.getCell("D4").value = -0.001;
  const patches = await api.parsePreviousWorkbook(await api.serializeWorkbook(wb), plan);
  assert.deepEqual(patches.map(p => [p.month, p.before, p.after]), [[4, "123.456", "0"], [5, "0", "-0.001"]]);
  assert.equal(patches[0].industryIdentity, plan.industries[0].identity);
  const legacy = { ...plan, industries: plan.industries.map(({ identity, ...i }) => i), departments: plan.departments.map(({ identity, ...d }) => d) };
  const oldOutput = await api.createPreviousWorkbookBytes(legacy, pairs.slice(0, 1));
  assert.deepEqual(await api.parsePreviousWorkbook(oldOutput, legacy), []);
  const oldWorkbook = new ExcelJS.Workbook(); await oldWorkbook.xlsx.load(oldOutput);
  oldWorkbook.worksheets[0].getCell("C4").value = 0;
  const oldPatches = await api.parsePreviousWorkbook(await api.serializeWorkbook(oldWorkbook), legacy);
  assert.equal(oldPatches[0].industryIdentity, "legacy"); assert.equal(oldPatches[0].departmentIdentity, "legacy");
  assert.throws(() => api.createPreviousWorkbook({ ...plan, accounts: [] }, pairs.slice(0, 1)), /勘定科目を登録/);
  const manyPairs = Array.from({ length: 2033 }, (_, index) => ({ industryId: index + 1, departmentId: 1 }));
  assert.throws(() => api.createPreviousWorkbook({ ...plan, accounts: plan.accounts.slice(0, 1) }, manyPairs), /取り込み上限/, "ZIP項目数も生成前に制限");
  const longName = { ...plan, accounts: [{ ...plan.accounts[0], accountName: "a".repeat(9 * 1024 * 1024) }] };
  await assert.rejects(api.createPreviousWorkbookBytes(longName, pairs.slice(0, 1)), /取り込み上限.*別ファイル/, "実際の展開後サイズもダウンロード前に制限");
  assert.deepEqual(plan, before, "出力・拒否・再取り込みで計画を変更しない");
  console.log("previous workbook export ok: 330 accounts, 18 pairs, boundary, split, empty/zero, identities and expanded size");
}
