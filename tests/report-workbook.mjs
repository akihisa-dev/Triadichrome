import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Evaluate the simple exported formula subset, using original values rather than caches.
function evaluator(wb) {
  const cache = new Map(), visiting = new Set();
  const value = (sheet, address) => {
    const key = `${sheet.name}:${address}`;
    if (cache.has(key)) return cache.get(key);
    assert.ok(!visiting.has(key), `循環参照: ${key}`); visiting.add(key);
    const cell = sheet.getCell(address);
    if (cell.isMerged && cell.master.address !== cell.address) { visiting.delete(key); return 0; }
    let result = cell.value ?? 0;
    if (cell.formula) {
      const ranges = [];
      let expr = cell.formula.replace(/(?:'([^']+)'!)?(\$?[A-Z]+\$?\d*):(\$?[A-Z]+\$?\d*)/g, (_, name, first, last) => {
        const target = name ? wb.getWorksheet(name) : sheet;
        const start = target.getCell(first.replaceAll('$', '').match(/\d/) ? first.replaceAll('$', '') : first.replaceAll('$', '') + '1');
        const end = target.getCell(last.replaceAll('$', '').match(/\d/) ? last.replaceAll('$', '') : last.replaceAll('$', '') + Math.max(1, target.rowCount));
        const values = [];
        for (let row = start.row; row <= end.row; row++) for (let col = start.col; col <= end.col; col++) values.push(value(target, target.getCell(row, col).address));
        ranges.push(values); return `ranges[${ranges.length - 1}]`;
      });
      expr = expr.replace(/(?:'([^']+)'!)?\b([A-Z]+\d+)\b/g, (_, name, ref) => `(${JSON.stringify(value(name ? wb.getWorksheet(name) : sheet, ref))})`).replace(/(?<![<>=!])=(?!=)/g, '===');
      result = Function('ranges', 'SUM', 'SUMIF', 'SUMIFS', 'IF', 'OR', `return (${expr})`)(ranges,
        (...values) => { assert.ok(values.length <= 255, 'ExcelのSUM引数上限'); return values.flat(Infinity).reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0); },
        (criteria, match, amounts) => amounts.reduce((sum, amount, index) => criteria[index] === match ? sum + (typeof amount === 'number' ? amount : 0) : sum, 0),
        (amounts, ...criteria) => amounts.reduce((sum, amount, index) => criteria.every((item, i) => i % 2 === 0 || criteria[i - 1][index] === item) ? sum + (typeof amount === 'number' ? amount : 0) : sum, 0),
        (condition, yes, no) => condition ? yes : no, (...conditions) => conditions.some(Boolean));
    }
    visiting.delete(key); cache.set(key, result); return result;
  };
  return value;
}
const settings = (tables, selected = [2, 1], filter = { industries: null, departments: null }) => ({ tables,
  selections: { 'cost-table': selected, 'expansion-table': selected, 'initiative-list': [2] }, costFilter: filter });
async function exported(api, plan, options) {
  const bytes = await api.serializeWorkbook(api.createReportWorkbook(plan, options));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  const archive = await JSZip.loadAsync(bytes);
  assert.equal(archive.file('xl/metadata.xml'), null);
  assert.ok(!Object.keys(archive.files).some(name => /externalLinks|vbaProject/.test(name)));
  return wb;
}
function reconcile(wb) {
  const evaluate = evaluator(wb);
  for (const sheet of wb.worksheets) sheet.eachRow(row => row.eachCell(cell => {
    if (!cell.formula) return;
    assert.doesNotMatch(cell.formula, /_xlfn|LAMBDA|LET\(|MAP\(|FILTER\(|XLOOKUP|TC_/);
    const result = evaluate(sheet, cell.address);
    if (typeof cell.result === 'number') assert.ok(Math.abs(result - cell.result) < 1e-7, `${sheet.name}!${cell.address}: ${result} != ${cell.result}`);
    else assert.equal(result, cell.result ?? "");
  }));
}
export async function verifyReportWorkbooks(api, sample) {
  const tables = ['cost-table', 'expansion-table', 'initiative-list'];
  for (let mask = 1; mask < 8; mask++) for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const chosen = tables.filter((_, index) => mask & (1 << index));
    const wb = await exported(api, sample, settings(chosen, selected));
    assert.deepEqual(wb.worksheets.map(s => s.name), [...['総原価表', '施策一覧', '展開表'].filter(n => wb.getWorksheet(n)), '計算元']);
    reconcile(wb);
    const list = wb.getWorksheet('施策一覧');
    if (list) {
      assert.deepEqual([1, 2, 3, 4].map(col => list.getCell(3, col).value), ['展開名', '期間名', '施策名', '開始年月']);
      assert.equal(list.views[0].xSplit, 4);
    }
    const expansion = wb.getWorksheet('展開表');
    if (expansion) {
      assert.ok(expansion.getCell('A9').isMerged, '元の展開名の本文結合を維持');
      assert.deepEqual([1, 2, 3].map(col => expansion.getCell(3, col).value), ['展開名', '期間名', '施策名']);
      assert.equal(expansion.views[0].xSplit, 3);
      const grouped = api.buildKindExpansionTable(sample, selected, 'registered');
      let row = 9;
      for (const group of grouped.groups) {
        for (const period of api.groupExpansionPeriods(group.initiatives, sample.periodTypes)) {
          const start = row;
          for (const item of period.initiatives) {
            assert.equal(expansion.getCell(row, 2).value, period.name);
            assert.equal(expansion.getCell(row++, 3).value, item.name);
          }
          if (row - start > 1) assert.equal(expansion.getCell(row - 1, 2).master.address, `B${start}`);
        }
        assert.equal(expansion.getCell(row++, 2).value, `${group.expansion.expansionName}計`);
      }
    }
  }
  for (const filter of [ { industries: [sample.industries[0].id], departments: null }, { industries: null, departments: [sample.departments[0].id] }, { industries: [], departments: null } ]) {
    const wb = await exported(api, sample, settings(tables, [1, 2], filter)); reconcile(wb);
    assert.equal(wb.getWorksheet('計算元').rowCount, api.createReportWorkbook(sample, settings(tables)).getWorksheet('計算元').rowCount, '元データは絞り込みで削らない');
  }
  // Every source amount can be changed; SUMIFS follows copied rows without enumerating addresses.
  const wb = await exported(api, sample, settings(tables, [1, 2]));
  const source = wb.getWorksheet('計算元');
  const account = sample.accounts.find(a => a.accountType === 'sales');
  const row = source.getRows(2, source.rowCount - 1).find(r => r.getCell(21).value === account.id && r.getCell(23).value === 1);
  const report = wb.getWorksheet('総原価表');
  const accountRow = report.getRows(5, report.rowCount - 4).find(r => r.getCell(1).value === account.accountName);
  const before = evaluator(wb)(report, accountRow.getCell(3).address);
  row.getCell(9).value += 1.234;
  assert.ok(Math.abs(evaluator(wb)(report, accountRow.getCell(3).address) - before - 1.234) < 1e-7);
  const copied = source.addRow(row.values);
  copied.getCell(9).value = 7.654;
  assert.ok(Math.abs(evaluator(wb)(report, accountRow.getCell(3).address) - before - 1.234 - 7.654) < 1e-7);
  assert.match(accountRow.getCell(3).formula, /SUMIFS/);
  assert.match(report.getCell(accountRow.number, 2 + 3 * 5 + 1).formula, /SUMIF\([A-Z]+\d+:[A-Z]+\d+/, '四半期は連続範囲の条件集計');
  // #16: separated subtotals at and beyond Excel's argument limit; empty groups stay harmless.
  for (const count of [255, 256]) for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const large = { ...sample, previousAmounts: [],
      expansions: Array.from({ length: count + 3 }, (_, i) => ({ id: i + 1, expansionCode: String(i + 1), expansionName: `展開${i + 1}` })),
      initiatives: Array.from({ length: count }, (_, i) => ({ ...sample.initiatives[0], id: i + 1, name: `施策${i + 1}`, expansionId: i + 2,
        rows: [{ ...sample.initiatives[0].rows[0], accountId: account.id, amounts: { 4: "1" }, overrides: { 2: { 4: "2" } } }] })) };
    const output = await exported(api, large, settings(['expansion-table'], selected));
    const report = output.getWorksheet('展開表');
    // Inspect all generated SUM calls independently of cached values or JS's unbounded arguments.
    report.eachRow(row => row.eachCell(cell => {
      if (!cell.formula) return;
      const calls = [];
      for (const token of cell.formula.matchAll(/([A-Z]+)\(|[(),]/g)) {
        if (token[0].endsWith('(')) calls.push({ name: token[1], count: 1 });
        else if (token[0] === ',') calls.at(-1).count++;
        else if (token[0] === ')') { const call = calls.pop(); if (call?.name === 'SUM') assert.ok(call.count <= 255, cell.address); }
      }
    }));
    const values = evaluator(output);
    selected.forEach((kind, i) => {
      assert.equal(values(report, report.getCell(8, 4 + i * 2).address), count * kind);
      assert.equal(values(report, report.getCell(8, 4 + i * 2 + 1).address), count * kind);
    });
    if (selected.length === 2) assert.equal(values(report, 'H8'), count);
    const source = output.getWorksheet('計算元');
    const changedRow = source.getRows(2, source.rowCount - 1).find(row => row.getCell(23).value === selected[0]);
    changedRow.getCell(9).value += 0.125;
    assert.equal(evaluator(output)(report, 'D8'), count * selected[0] + 0.125, '元金額の編集を二重計上せず反映');
  }
  console.log('report workbook ok: original sheets, basic formulas, all selections, source edits, added source rows, filters and cached reconciliation');
}
