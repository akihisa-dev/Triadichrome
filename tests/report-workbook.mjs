import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Evaluate the simple exported formula subset, using original values rather than caches.
function evaluator(wb) {
  const rangeCache = new Map(), cache = new Map(), visiting = new Set();
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
        const rangeKey = `${target.name}:${first}:${last}`;
        if (rangeCache.has(rangeKey)) { ranges.push(rangeCache.get(rangeKey)); return `ranges[${ranges.length - 1}]`; }
        const start = target.getCell(first.replaceAll('$', '').match(/\d/) ? first.replaceAll('$', '') : first.replaceAll('$', '') + '1');
        const end = target.getCell(last.replaceAll('$', '').match(/\d/) ? last.replaceAll('$', '') : last.replaceAll('$', '') + Math.max(1, target.rowCount));
        const values = [];
        for (let row = start.row; row <= end.row; row++) for (let col = start.col; col <= end.col; col++) values.push(value(target, target.getCell(row, col).address));
        rangeCache.set(rangeKey, values);
        ranges.push(values); return `ranges[${ranges.length - 1}]`;
      });
      expr = expr.replace(/(?:'([^']+)'!)?\b([A-Z]+\d+)\b/g, (_, name, ref) => `(${JSON.stringify(value(name ? wb.getWorksheet(name) : sheet, ref))})`).replace(/(?<![<>=!])=(?!=)/g, '===').replaceAll('&', '+');
      result = Function('ranges', 'SUM', 'SUMIF', 'SUMIFS', 'IF', 'OR', 'INT', 'MOD', 'ABS', 'ISNUMBER', 'TEXT', 'LEFT', 'MID', 'LEN', 'FIND', 'VALUE', `return (${expr})`)(ranges,
        (...values) => { assert.ok(values.length <= 255, 'ExcelのSUM引数上限'); return values.flat(Infinity).reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0); },
        (criteria, match, amounts) => amounts.reduce((sum, amount, index) => criteria[index] === match ? sum + (typeof amount === 'number' ? amount : 0) : sum, 0),
        (amounts, ...criteria) => amounts.reduce((sum, amount, index) => criteria.every((item, i) => i % 2 === 0 || criteria[i - 1][index] === item) ? sum + (typeof amount === 'number' ? amount : 0) : sum, 0),
        (condition, yes, no) => condition ? yes : no, (...conditions) => conditions.some(Boolean),
        Math.floor, (number, divisor) => ((number % divisor) + divisor) % divisor, Math.abs, value => typeof value === 'number',
        (number, format) => { assert.equal(format, '0.000'); return Number(number).toFixed(3); },
        (value, count) => String(value).slice(0, count), (value, start, count) => String(value).slice(start - 1, start - 1 + count),
        value => String(value).length, (needle, value) => { const position = String(value).indexOf(needle); assert.ok(position >= 0); return position + 1; }, Number);
    }
    visiting.delete(key); cache.set(key, result); return result;
  };
  return value;
}
const rounded = yen => { const amount = BigInt(yen), absolute = amount < 0n ? -amount : amount; return Number((amount < 0n ? -1n : 1n) * ((absolute + 500n) / 1000n)); };
// Excel adjusts relative row references when a source row is copied.
function copySourceRow(source, row) {
  const copied = source.addRow(row.values);
  copied.eachCell(cell => { if (cell.formula) cell.value = { formula: cell.formula.replace(/\b([A-Z]+)(\d+)\b/g, (_, column, number) => `${column}${Number(number) + copied.number - row.number}`) }; });
  return copied;
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
    if (cell.result === undefined && sheet.getColumn(Number(cell.col)).hidden) return;
    if (typeof cell.result === 'number') assert.ok(Math.abs(result - cell.result) <= Math.max(1e-7, Math.abs(cell.result) * 1e-12), `${sheet.name}!${cell.address}: ${result} != ${cell.result}`);
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
  // #19: exact cancellation and rounding boundaries survive real XLSX serialization.
  for (const large of ['9007199254740.990', '9007199254740.991']) for (const sign of [1, -1]) for (const remainder of [499, 500]) {
    const opposite = api.yenToAmount(api.amountToYen(large) - remainder);
    const rows = [large, opposite].map((amount, index) => ({ ...sample.initiatives[0].rows[0], accountId: sample.accounts.find(a => a.accountType === 'sales').id,
      amounts: Object.fromEntries([4, 5, 6].map(month => [month, `${(index === 0 ? sign : -sign) < 0 ? '-' : ''}${amount}`])),
      overrides: index === 1 ? { 2: Object.fromEntries([4, 5, 6].map(month => [month, api.yenToAmount(-sign * (api.amountToYen(amount) - 1))])) } : {} }));
    const precise = { ...sample, previousAmounts: [large, opposite].map((amount, index) => ({ industryId: 1, departmentId: index + 1,
      accountId: rows[0].accountId, month: 4, amount: `${(index === 0 ? sign : -sign) < 0 ? '-' : ''}${amount}` })), initiatives: [{ ...sample.initiatives[0], rows }] };
    for (const kind of [1, 2]) {
      const options = settings(tables, [1, 2]); options.selections['initiative-list'] = [kind];
      const output = await exported(api, precise, options);
      reconcile(output);
      const list = output.getWorksheet('施策一覧');
      assert.equal(list.getCell('E5').result, rounded(sign * (remainder + kind - 1)));
      assert.equal(list.getCell('E6').result, rounded(sign * (remainder + kind - 1)));
      const expansion = output.getWorksheet('展開表');
      assert.equal(expansion.getCell('D8').result, rounded(sign * remainder));
      assert.equal(expansion.getCell('F8').result, rounded(sign * (remainder + 1)));
      assert.equal(expansion.getCell(8, 4 + 3 * 6).result, rounded(sign * remainder * 3));
      assert.equal(expansion.getCell(8, 6 + 3 * 6).result, rounded(sign * (remainder + 1) * 3));
      assert.equal(expansion.getCell('H8').result, 0, '比較差は表示の丸め前の1円を使う');
      assert.equal(expansion.getCell('D6').result, rounded(sign * remainder), '前年も大きい正負を正確に相殺する');
      const source = output.getWorksheet('計算元');
      const input = source.getRows(2, source.rowCount - 1).find(row => row.getCell(23).value === kind);
      const oppositeRow = source.getRows(2, source.rowCount - 1).filter(row => row.getCell(23).value === kind)[1];
      if (typeof oppositeRow.getCell(9).value === 'string') assert.equal(oppositeRow.getCell(9).numFmt, '@', '編集後も文字列を保持');
      assert.equal(api.amountToYen(String(oppositeRow.getCell(9).value)), -sign * (api.amountToYen(opposite) - kind + 1));
      assert.equal(api.amountToYen(String(input.getCell(9).value)), sign * api.amountToYen(large));
      // Source edits retain the last yen and feed differences/periods before display rounding.
      input.getCell(9).value = `${sign < 0 ? '-' : ''}${api.yenToAmount(api.amountToYen(large) - 1)}`;
      assert.equal(evaluator(output)(list, 'E5'), rounded(sign * (remainder + kind - 2)));
      const copy = copySourceRow(source, input); copy.getCell(9).value = `${sign < 0 ? '-' : ''}0.002`;
      assert.equal(evaluator(output)(list, 'E5'), rounded(sign * (remainder + kind)));
    }
  }
  // Every source amount can be changed; SUMIFS follows copied rows without enumerating addresses.
  const wb = await exported(api, sample, settings(tables, [1, 2]));
  const source = wb.getWorksheet('計算元');
  const account = sample.accounts.find(a => a.accountType === 'sales');
  const row = source.getRows(2, source.rowCount - 1).find(r => r.getCell(21).value === account.id && r.getCell(23).value === 1);
  const report = wb.getWorksheet('総原価表');
  const accountRow = report.getRows(5, report.rowCount - 4).find(r => r.getCell(1).value === account.accountName);
  const beforeYen = api.buildPeriodCostComparison(sample, [1, 2]).rows.find(row => row.kind === 'account' && row.id === account.id).values[1]['4'];
  row.getCell(9).value += 1.234;
  assert.equal(evaluator(wb)(report, accountRow.getCell(3).address), rounded(BigInt(beforeYen) + 1234n));
  const copied = copySourceRow(source, row);
  copied.getCell(9).value = 7.654;
  assert.equal(evaluator(wb)(report, accountRow.getCell(3).address), rounded(BigInt(beforeYen) + 1234n + 7654n));
  const visibleWidth = report.columnCount / 4;
  assert.match(report.getCell(accountRow.number, visibleWidth + 3).formula, /SUMIFS/);
  assert.match(report.getCell(accountRow.number, visibleWidth + 2 + 3 * 5 + 1).formula, /SUMIF\([A-Z]+\d+:[A-Z]+\d+/, '四半期は連続範囲の条件集計');
  // #20: footer caches and formulas include every initiative of the selected kind.
  for (const kind of [1, 2]) for (const empty of [false, true]) {
    const plan = { ...sample, initiatives: empty ? [] : sample.initiatives };
    const options = settings(['initiative-list']); options.selections['initiative-list'] = [kind];
    const output = await exported(api, plan, options);
    const list = output.getWorksheet('施策一覧');
    const totalRow = list.rowCount;
    assert.equal(list.getCell(totalRow, 1).value, '合計');
    assert.equal(list.getCell(totalRow, 4).master.address, `A${totalRow}`);
    const totals = api.initiativeTotals(api.initiativesForKind(plan.initiatives, plan.accounts, kind));
    const evaluate = evaluator(output);
    for (const [mi, month] of api.initiativeMonths.entries()) for (const [i, metric] of ['sales', 'expense', 'profit'].entries()) {
      const cell = list.getCell(totalRow, 5 + mi * 3 + i);
      assert.equal(cell.result, totals[month][metric] === null ? '属性未設定' : rounded(totals[month][metric]));
      assert.equal(evaluate(list, cell.address), cell.result);
    }
    if (!empty) {
      const source = output.getWorksheet('計算元');
      const row = source.getRows(2, source.rowCount - 1).find(r => r.getCell(8).value === 'sales' && r.getCell(23).value === kind);
      const beforeYen = totals[4].sales;
      row.getCell(9).value += 0.125;
      assert.equal(evaluator(output)(list, `E${totalRow}`), rounded(BigInt(beforeYen) + 125n));
      const copied = copySourceRow(source, row); copied.getCell(9).value = -0.625;
      assert.equal(evaluator(output)(list, `E${totalRow}`), rounded(BigInt(beforeYen) - 500n));
    }
  }
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
    assert.equal(evaluator(output)(report, 'D8'), count * selected[0], '元金額の編集を二重計上せず反映');
  }
  console.log('report workbook ok: original sheets, basic formulas, all selections, source edits, added source rows, filters and cached reconciliation');
}
