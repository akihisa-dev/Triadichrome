import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function verifyPerformanceData(api, root) {
  const bytes = new Uint8Array(await readFile(join(root, 'samples/全機能確認用.triadic')));
  const compact = await api.readPlanContents(bytes, false);
  assert.equal(compact.details, undefined, '通常の読込では派生明細を作らない');
  const complete = await api.readPlanContents(bytes);
  assert.deepEqual({...compact, details: api.buildDetails(compact)}, complete, '派生表示を省いても全金額と更新番号を保持');
  const rules = new Map(compact.periodTypes.map(item => [item.id, item.startMonthRule]));
  for (const item of compact.initiatives) for (const kind of [1,2]) {
    assert.equal(item.startYearMonths[kind], api.deriveStartYearMonth(compact.fiscalYear, rules.get(item.periodTypeId) ?? null, item.rows, kind), 'SQLの非0判定と元の各行の判定が一致');
  }
  assert.deepEqual(api.visibleRows(1000,40,0,400,80), {start:0,end:16});
  assert.deepEqual(api.visibleRows(1000,40,40080,400,80), {start:992,end:1000});
  assert.deepEqual(api.visibleRows(0,40,0,400), {start:0,end:0});
  assert.ok(api.visibleRows(289704,34,5000000,500).end-api.visibleRows(289704,34,5000000,500).start < 40);
  console.log('PASS: 大規模データの全件整合性、開始年月、部分描画');
}
