import assert from 'node:assert/strict';

export async function verifyInitiativeListRendering(api) {
  let bytes = await api.createTriadicDatabase(2026);
  const accounts = (await api.readPlanContents(bytes)).accounts;
  const accountId = accounts.find(account => account.accountType === 'sales').id;
  const draft = { ...api.createInitiativeDraft('2026'), name: '施策内上限確認', expansionId: 1, industryId: 1, departmentId: 1,
    rows: [1, 2].map(() => ({ accountId, amounts: { 4: '0' }, overrides: { 2: { 4: '5000000000000' } } })) };
  bytes = await api.registerInitiative(bytes, draft);
  bytes = await api.registerInitiative(bytes, { ...draft, name: '通常確認', rows: [{ accountId, amounts: { 4: '1' }, overrides: { 2: { 4: '2' } } }] });
  const contents = await api.readPlanContents(bytes);
  const before = structuredClone(contents);
  const viewForKind = api.createInitiativeListView(contents.initiatives, accounts, '2026');
  const primaryView = viewForKind(1);
  const confirmedView = viewForKind(2);
  assert.equal(viewForKind(1), primaryView, '種別を戻すと同じ検証済みの計算結果と合計を再利用');
  assert.equal(viewForKind(2), confirmedView);
  assert.equal(primaryView.errors.size, 0);
  assert.deepEqual(primaryView.totals, api.initiativeTotals(api.initiativesForKind(contents.initiatives, accounts, 1)));
  assert.equal(confirmedView.errors.size, 1, '上限超過した施策を種別ごとに隔離する');
  assert.equal(confirmedView.totals, null, '一部の施策を除外した不完全な合計を出さない');
  assert.equal(confirmedView.source[1].months[4].sales, 2000);
  const changedAccounts = accounts.map(account => account.id === accountId ? { ...account, accountType: 'expense' } : account);
  const changedView = api.createInitiativeListView(contents.initiatives, changedAccounts, '2026')(1);
  assert.equal(changedView.source[1].months[4].sales, 0, '科目属性の変更後は新しい計算元から求める');
  assert.equal(changedView.source[1].months[4].expense, 1000);
  const otherYear = api.createInitiativeListView(contents.initiatives, accounts, '2025')(1);
  assert.equal(otherYear.source.length, 0);
  assert.deepEqual(otherYear.totals, api.initiativeTotals([]), '年度が変わると前の年度の結果を使わない');

  assert.throws(() => api.initiativesForKind(contents.initiatives, accounts, 2), /範囲を超え/);
  const confirmed = api.renderInitiativeList(contents, 2);
  assert.match(confirmed, /role="alert"[^>]*>金額の合計が正確に計算できる範囲を超えています/);
  assert.match(confirmed, /<button[^>]*>施策内上限確認<\/button>/, '超過した施策の編集導線を残す');
  assert.match(confirmed, /通常確認<\/button>[\s\S]*?<td>2<\/td>/, '正常な施策は選択種別の金額を表示');
  assert.match(confirmed, /計算できない施策があるため、合計を表示できません/);
  assert.doesNotMatch(api.renderInitiativeList(contents, 1), /role="alert"/);
  assert.deepEqual(contents, before, '表示失敗で保存データを変更しない');
  const correction = { ...draft, rows: structuredClone(contents.initiatives[0].rows) };
  correction.rows[0].overrides[2][4] = '1';
  const corrected = await api.updateInitiative(bytes, contents.initiatives[0].id, 2026, correction);
  const correctedContents = await api.readPlanContents(corrected);
  assert.doesNotMatch(api.renderInitiativeList(correctedContents, 2), /role="alert"/);
  const correctedView = api.createInitiativeListView(correctedContents.initiatives, accounts, '2026')(2);
  assert.equal(correctedView.errors.size, 0, '金額修正後はエラー結果を再利用しない');
  assert.equal(correctedView.source[0].months[4].sales, 5000000000001000);
  assert.deepEqual(correctedView.totals, api.initiativeTotals(correctedView.source));
  const huge = { ...correctedContents.initiatives[1], rows: [{ accountId, amounts: { 4: '5000000000000' } }] };
  const overflowTotal = api.createInitiativeListView([huge, { ...huge, id: -1 }], accounts, '2026')(1);
  assert.equal(overflowTotal.errors.size, 0);
  assert.equal(overflowTotal.totals, null, '施策ごとには正常でも全件合計の上限超過を拒否');
  assert.match(overflowTotal.totalError, /範囲を超え/);

  assert.equal(api.initiativesForKind(correctedContents.initiatives, accounts, 2)[0].months[4].sales, 5000000000001000);
  console.log('PASS: 確定予算の施策内超過、編集導線、正常行と種別切替、元データ保持、修正保存後の再表示');
}
