import assert from 'node:assert/strict';

export async function verifyExpansionTableView(api) {
  const contents = await api.readPlanContents(await api.createSamplePlan(2026));
  const before = structuredClone(contents);
  const viewForSelection = api.createExpansionTableView(contents);
  for (const selected of [[1], [2], [1, 2], [2, 1]]) {
    const view = viewForSelection(selected);
    assert.deepEqual(view.table, api.buildKindExpansionTable(contents, selected, 'registered'), '前年・合計・小計・施策の円単位金額と比較方向を維持');
    assert.equal(viewForSelection([...selected]), view, '選択配列が作り直されても同じ組み合わせの結果を再利用');
    assert.equal(view.flat.length, view.table.groups.reduce((sum, group) => sum + group.initiatives.length + 1, 0));
    for (const { group, periods } of view.groups) {
      assert.deepEqual(periods, api.groupExpansionPeriods(group.initiatives, contents.periodTypes), '未設定を含む期間順と縦結合の対象を維持');
      assert.deepEqual(view.flat.filter(row => row.group === group && !row.subtotal).map(row => row.item.id), periods.flatMap(period => period.initiatives.map(item => item.id)));
    }
    for (const period of api.tablePeriods) for (const metric of ['sales', 'profit']) {
      assert.deepEqual(view.table.total.map(months => api.expansionPeriodAmount(months, period, metric)), api.buildKindExpansionTable(contents, selected, 'registered').total.map(months => api.expansionPeriodAmount(months, period, metric)), '月・四半期・半期・年間の丸め前金額を維持');
    }
  }
  assert.notEqual(viewForSelection([1, 2]), viewForSelection([2, 1]), '列順を異なる選択として保持');
  const variants = [
    { ...contents, initiatives: contents.initiatives.map((item, i) => i ? item : { ...item, rows: item.rows.map(row => ({ ...row, amounts: { ...row.amounts, 4: '1.001' } })) }) },
    { ...contents, accounts: contents.accounts.map(account => ({ ...account, accountType: null })) },
    { ...contents, previousAmounts: [] },
    { ...contents, expansions: contents.expansions.map(item => ({ ...item, expansionName: item.expansionName + '更新' })) },
    { ...contents, periodTypes: [...contents.periodTypes].reverse() },
    { ...contents, fiscalYear: 2025 },
  ];
  for (const changed of variants) {
    const fresh = api.createExpansionTableView(changed)([1, 2]);
    assert.notEqual(fresh, viewForSelection([1, 2]), '計算元変更後のキャッシュは独立');
    assert.deepEqual(fresh.table, api.buildKindExpansionTable(changed, [1, 2], 'registered'));
  }
  const salesId = contents.accounts.find(account => account.accountType === 'sales').id;
  const huge = { ...contents, initiatives: contents.initiatives.slice(0, 1).map(item => ({ ...item, rows: [1, 2].map(() => ({ accountId: salesId, amounts: { 4: '5000000000000' } })) })) };
  const overflowing = api.createExpansionTableView(huge);
  assert.throws(() => overflowing([1]), /範囲/);
  assert.throws(() => overflowing([1]), /範囲/, '失敗した計算を有効な結果として登録しない');
  assert.deepEqual(contents, before, '計算・再利用・失敗で入力データを変更しない');
  console.log('PASS: 展開表の選択再利用、逆順比較、期間計と行順、計算元変更、上限超過と入力保持');
}
