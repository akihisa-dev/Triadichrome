import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { SaxesParser } from 'saxes';
import { withNodeBundle } from '../scripts/node-bundle.mjs';
import { evaluator } from './report-workbook.mjs';

// Compare the production React markup, not a second implementation of its table model.
function textOf(markup) {
  let text = '';
  const parser = new SaxesParser();
  parser.on('text', value => { text += value; });
  parser.write(`<root>${markup}</root>`).close();
  return text.replace(/[\r\n]/g, '');
}
export function markupCells(markup) {
  const table = markup.match(/<table\b[^>]*>([\s\S]*?)<\/table>/)[1];
  const occupied = new Set(), cells = [];
  let row = 0;
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    row++; let col = 1;
    for (const cell of match[1].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      while (occupied.has(`${row}:${col}`)) col++;
      const rowspan = Number(cell[2].match(/rowspan="(\d+)"/i)?.[1] ?? 1);
      const colspan = Number(cell[2].match(/colspan="(\d+)"/i)?.[1] ?? 1);
      cells.push({ row, col, rowspan, colspan, text: textOf(cell[3]) });
      for (let r = row; r < row + rowspan; r++) for (let c = col; c < col + colspan; c++) occupied.add(`${r}:${c}`);
      col += colspan;
    }
  }
  return cells;
}
// This deliberately reads Excel's stored number format, independently of app formatters.
export function excelText(cell, value = cell.formula ? cell.result : cell.value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value).replace(/[\r\n]/g, '');
  const format = cell.numFmt;
  const rate = format.includes('0.0');
  const threshold = Number(format.match(/\[>=([\d.]+)\]/)?.[1] ?? 0);
  if (Math.abs(value) < threshold) return '';
  const number = new Intl.NumberFormat('ja-JP', { minimumFractionDigits: rate ? 1 : 0, maximumFractionDigits: rate ? 1 : 0 }).format(value);
  return number + (format.includes('"pt"') ? 'pt' : format.includes('"%"') ? '%' : '');
}
export function workbookCells(ws, evaluate) {
  const merges = new Map(ws.model.merges.map(range => {
    const [first, last] = range.split(':').map(address => ws.getCell(address));
    return [`${first.row}:${first.col}`, { top: first.row, left: first.col, bottom: last.row, right: last.col }];
  }));
  const cells = [];
  for (let row = 3; row <= ws.rowCount; row++) for (let col = 1; col <= ws.columnCount; col++) {
    if (ws.getColumn(col).hidden) continue;
    const cell = ws.getCell(row, col);
    if (cell.isMerged && cell.master.address !== cell.address) continue;
    const merge = merges.get(`${row}:${col}`);
    cells.push({ row: row - 2, col, rowspan: merge ? merge.bottom - merge.top + 1 : 1,
      colspan: merge ? merge.right - merge.left + 1 : 1,
      text: excelText(cell, evaluate && cell.formula ? evaluate(ws, cell.address) : cell.formula ? cell.result : cell.value) });
  }
  return cells;
}
export async function verifyReportParity(api) {
  const sample = await api.readPlanContents(await api.createSamplePlan(2026));
  const empty = await api.readPlanContents(await api.createTriadicDatabase(2026));
  const boundaries = { ...sample, previousAmounts: [], initiatives: [{ ...sample.initiatives[0], name: '丸め 境界 & <確認>',
    rows: [{ ...sample.initiatives[0].rows[0], accountId: sample.accounts.find(a => a.accountType === 'sales').id,
      amounts: Object.fromEntries(api.initiativeMonths.map((month, i) => [month, ['0.499', '0.5', '-0.499', '-0.5', '0', '1.499', '-1.5', '1234.567', '-1234.567', '0.001', '-0.001', '0'][i]])),
      overrides: { 2: { 4: '0.5', 5: '0.499', 6: '-0.5', 7: '-0.499' } } }] }] };
  for (const [scenario, plan] of [['全機能', sample], ['施策なし', empty],
    ['丸め境界', boundaries], ['未設定', { ...sample, accounts: sample.accounts.map(a => ({ ...a, accountType: null })) }],
    ['分類絞り込み', sample]]) {
    for (const selected of [[1], [2], [1, 2], [2, 1]]) for (const kind of [1, 2]) {
      const before = structuredClone(plan);
      const filter = scenario === '分類絞り込み' ? { industries: [sample.industries[0].id], departments: [sample.departments[0].id] }
        : { industries: null, departments: null };
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await api.serializeWorkbook(api.createReportWorkbook(plan, {
        tables: ['cost-table', 'expansion-table', 'initiative-list'], costFilter: filter,
        selections: { 'cost-table': selected, 'expansion-table': selected, 'initiative-list': [kind] },
      })));
      const markup = api.renderReportTables(plan, selected, kind, api.filterPlan(plan, filter));
      const evaluate = evaluator(wb);
      for (const [name, html] of Object.entries(markup)) {
        assert.deepEqual(workbookCells(wb.getWorksheet(name)), markupCells(html), `${scenario} ${name} 比較${selected} 施策種別${kind}`);
        assert.deepEqual(workbookCells(wb.getWorksheet(name), evaluate), markupCells(html), `${scenario} ${name} 元金額から再計算`);
      }
      assert.deepEqual(plan, before, '照合と出力は計画を変更しない');
    }
  }
  const original = markupCells(api.renderReportTables(sample, [1], 1).施策一覧);
  for (const change of [ws => { ws.getCell('A3').value = '誤った見出し'; },
    ws => { ws.getCell('E5').value = 999; }, ws => { ws.unMergeCells('A3:A4'); }]) {
    const ws = api.createReportWorkbook(sample, { tables: ['initiative-list'], costFilter: { industries: null, departments: null },
      selections: { 'cost-table': [1], 'expansion-table': [1], 'initiative-list': [1] } }).getWorksheet('施策一覧');
    assert.deepEqual(workbookCells(ws), original);
    change(ws);
    assert.notDeepEqual(workbookCells(ws), original, '見出し・値・結合の不一致を検出する');
  }
  console.log('report parity ok: production React tables vs serialized XLSX, every visible cell and merge');
}
if (process.argv[1]?.endsWith('/report-parity.mjs')) await withNodeBundle('tests/report-parity-api.ts', verifyReportParity);
