import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyPerformanceData(api, root) {
  const bytes = new Uint8Array(await readFile(join(root, 'samples/全機能確認用.triadic')));
  const compact = await api.readPlanContents(bytes, false);
  assert.equal(compact.details, undefined, '通常の読込では派生明細を作らない');
  const complete = await api.readPlanContents(bytes);
  assert.deepEqual({...compact, details: api.buildDetails(compact)}, complete, '明細の遅延生成でも全金額と更新番号を保持');
  const rules = new Map(compact.periodTypes.map(item => [item.id, item.startMonthRule]));
  for (const item of compact.initiatives) for (const kind of [1,2]) {
    assert.equal(item.startYearMonths[kind], api.deriveStartYearMonth(compact.fiscalYear, rules.get(item.periodTypeId) ?? null, item.rows, kind), 'SQLの非0判定と元の各行の判定が一致');
  }
  const task = api.processingTasks;
  const id = await task.detailOpen(compact, {column:'amount', direction:'descending'});
  const expected = api.sortTableRows(complete.details, api.detailColumns(compact), {column:'amount',direction:'descending'});
  const last = expected.length - 1;
  const page = await task.detailPage(id, 10, 30, expected[last].id);
  assert.deepEqual(page, [...expected.slice(10,30).map((item,i)=>({item,index:i+10})), {item:expected[last],index:last}], '全件を並べ替え、画面範囲と編集中の行だけ取得');
  assert.deepEqual(await task.detailNeighbor(id, expected[29].id, 1), {item:expected[30],index:30});
  assert.equal(await task.detailNeighbor(id, expected[0].id,-1), null);
  assert.equal(await task.detailNeighbor(id, expected[last].id,1), null);
  assert.equal(await task.detailNeighbor(id,'missing',1), null);
  await task.detailClose(id);
  await assert.rejects(task.detailPage(id,0,1), /やり直してください/);
  assert.deepEqual(api.visibleRows(1000,40,0,400,80), {start:0,end:16});
  assert.deepEqual(api.visibleRows(1000,40,40080,400,80), {start:992,end:1000});
  assert.deepEqual(api.visibleRows(0,40,0,400), {start:0,end:0});
  assert.ok(api.visibleRows(289704,34,5000000,500).end-api.visibleRows(289704,34,5000000,500).start < 40);
  console.log('PASS: 大規模データの全件整合性、開始年月、部分描画、全件ソート、編集行保持、Tab境界');
}
