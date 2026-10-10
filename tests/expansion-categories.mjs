import assert from "node:assert/strict";
export async function verifyExpansionCategories(api) {
  const original = await api.createTriadicDatabase(2026);
  assert.deepEqual((await api.readPlanContents(original)).expansionCategories, []);
  let bytes = original;
  for (const categoryName of ["詳細A", "共通", "未割当"]) bytes = await api.changeExpansionCategoryMaster(bytes, { type: "add", categoryName });
  await assert.rejects(api.changeExpansionCategoryMaster(bytes, { type: "add", categoryName: "詳細A" }), /同じ/);
  await assert.rejects(api.changeExpansionCategoryMaster(bytes, { type: "add", categoryName: " " }), /展開区分名/);
  const assign = (source, id, categoryIds) => api.changeExpansionMaster(source, { type: "update", id, expansionCode: String(id), expansionName: id === 1 ? "コスト" : "料改", categoryIds });
  bytes = await assign(bytes, 1, [1, 2]); bytes = await assign(bytes, 2, [2]);
  await assert.rejects(assign(bytes, 1, [999]), /展開区分/);
  await assert.rejects(api.changeExpansionCategoryMaster(bytes, { type: "delete", id: 1 }), /割り当て/);
  const plan = await api.readPlanContents(bytes);
  const draft = { name: "区分選択", note: "", expansionId: 1, expansionCategoryId: 1, industryId: 1, departmentId: 1, fiscalYear: "2026", rows: [{ accountId: plan.accounts[0].id, amounts: { 4: "123.456" } }] };
  await assert.rejects(api.registerInitiative(bytes, { ...draft, expansionId: 2 }), /展開区分/);
  bytes = await api.registerInitiative(bytes, draft);
  bytes = await api.registerInitiative(bytes, { ...draft, name: "任意未選択", expansionCategoryId: null });
  const saved = await api.readPlanContents(bytes);
  assert.equal(saved.initiatives[0].expansionCategoryId, 1);
  assert.equal(saved.initiatives[1].expansionCategoryId, null);
  assert.deepEqual(saved.initiatives[0].months, saved.initiatives[1].months, "区分で金額計算は変わらない");
  await assert.rejects(assign(bytes, 1, [2]), /使用/);
  const snapshot = await api.createBusinessSnapshot(bytes);
  bytes = await api.changeExpansionCategoryMaster(bytes, { type: "update", id: 1, categoryName: "改名後" });
  assert.equal((await api.readPlanContents(bytes)).expansionCategories[0].categoryName, "改名後");
  bytes = await api.applyOperationSnapshot(bytes, snapshot);
  assert.deepEqual(await api.readPlanContents(bytes), saved, "区分と割り当てと選択を一緒に復元");
  bytes = await api.changeExpansionCategoryMaster(bytes, { type: "delete", id: 3 });
  await api.validateTriadicDatabase(bytes);
  const db = await api.openTriadicDatabase(bytes);
  try { assert.throws(() => db.run("UPDATE initiatives SET expansion_id = 2 WHERE id = ?", [saved.initiatives[0].id]), /FOREIGN KEY/); } finally { db.close(); }
  assert.deepEqual((await api.readPlanContents(original)).expansionCategories, [], "失敗や変更で元bytesを変更しない");
  console.log("PASS: 展開区分の任意選択、割当制限、使用中保護、改名、復元、金額不変");
}
