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
  assert.equal(api.initiativesForKind(correctedContents.initiatives, accounts, 2)[0].months[4].sales, 5000000000001000);
  console.log('PASS: 確定予算の施策内超過、編集導線、正常行と種別切替、元データ保持、修正保存後の再表示');
}
