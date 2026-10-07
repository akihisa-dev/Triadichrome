import assert from "node:assert/strict";

export async function verifyYenPrecision(api) {
  const maximum = Number.MAX_SAFE_INTEGER;
  const annual = api.tablePeriods.find(period => period.id === "annual");
  const original = await api.createTriadicDatabase(2026);
  const defaults = await api.readPlanContents(original);
  const accountId = defaults.accounts.find(account => account.accountType === "sales").id;
  const priorInput = amount => ({ industryId: 1, departmentId: 1, rows: [{ accountId, amounts: { 4: amount } }] });
  const draft = amount => ({ ...api.createInitiativeDraft("2026"), name: "境界の精度確認", expansionId: 1, industryId: 1, departmentId: 1, rows: [{ accountId, amounts: { 4: amount } }] });
  const costAccount = contents => api.buildCostComparison(contents, [1, 2]).rows.find(row => row.kind === "account" && row.id === accountId);
  for (const sign of [1, -1]) {
    const text = `${sign < 0 ? "-" : ""}9007199254740.991`;
    const yen = sign * maximum;
    assert.equal(api.amountToYen(text), yen);
    assert.equal(api.yenToAmount(yen), text);
    // Stored source strings survive readback and every calculated value stays integer yen.
    const previousBytes = await api.savePreviousAmounts(original, priorInput(text));
    const previous = await api.readPlanContents(previousBytes);
    assert.equal(previous.previousAmounts.find(row => row.month === 4).amount, text);
    assert.equal(api.previousByAccount(previous).get(accountId)[4], yen);
    assert.equal(api.previousTotals(previous)[4].sales, yen);
    assert.deepEqual(costAccount(previous).values.map(values => values[4]), [yen, yen, yen, 0, 0]);
    const period = api.buildPeriodCostComparison(previous, [1, 2]).rows.find(row => row.kind === "account" && row.id === accountId);
    assert.deepEqual(period.values.map(values => values.annual), [yen, yen, yen, 0, 0]);
    assert.equal(api.expansionPeriodAmount(api.buildKindExpansionTable(previous, [1], "registered").total[0], annual, "sales"), yen);

    const initiativeBytes = await api.registerInitiative(original, draft(text));
    const contents = await api.readPlanContents(initiativeBytes);
    assert.equal(contents.initiatives[0].rows[0].amounts[4], text);
    assert.equal(contents.initiatives[0].months[4].sales, yen);
    assert.equal(api.amountToYen(contents.details.find(row => row.kindId === 1 && row.month === 4).sales), yen);
    assert.deepEqual(costAccount(contents).values.map(values => values[4]), [0, yen, yen, yen, 0]);
    const expansion = api.buildKindExpansionTable(contents, [1, 2], "registered");
    assert.deepEqual(expansion.changes.map(months => months[4].sales), [yen, yen, 0]);
    assert.equal(api.expansionPeriodAmount(expansion.total[0], annual, "sales"), yen);
    const corrected = { ...contents, initiatives: [{ ...contents.initiatives[0], rows: [{ ...contents.initiatives[0].rows[0], overrides: { 2: { 4: api.yenToAmount(yen - sign) } } }] }] };
    assert.equal(api.initiativesForKind(corrected.initiatives, corrected.accounts, 2)[0].months[4].sales, yen - sign);
    assert.deepEqual(costAccount(corrected).values.map(values => values[4]), [0, yen, yen - sign, yen - sign, -sign]);
    const compared = api.buildKindExpansionTable(corrected, [1, 2], "registered");
    assert.deepEqual(compared.changes.map(months => months[4].sales), [yen, yen - sign, -sign]);
    assert.equal(api.expansionPeriodAmount(compared.changes[2], annual, "sales"), -sign);
    const opposite = { ...contents, initiatives: [{ ...contents.initiatives[0], rows: [{ ...contents.initiatives[0].rows[0], overrides: { 2: { 4: api.yenToAmount(-yen) } } }] }] };
    assert.throws(() => costAccount(opposite), /範囲/);
    assert.throws(() => api.buildKindExpansionTable(opposite, [1, 2], "registered"), /範囲/);
    assert.equal(api.addYen(yen, -sign), yen - sign);
    assert.throws(() => api.addYen(yen, sign), /範囲/);
    assert.throws(() => api.addYen(yen, -(-yen)), /範囲/);
    assert.throws(() => api.expansionPeriodAmount({ 4: { sales: yen }, 5: { sales: sign } }, annual, "sales"), /範囲/);
    const overflowPrior = { ...previous, previousAmounts: [...previous.previousAmounts, { ...previous.previousAmounts[0], amount: api.yenToAmount(sign) }] };
    assert.throws(() => api.previousByAccount(overflowPrior), /範囲/);
    const differenceOverflow = { ...contents, previousAmounts: [{ ...previous.previousAmounts[0], amount: api.yenToAmount(-yen) }] };
    // Opposite values cannot be subtracted exactly within the allowed range.
    assert.throws(() => api.combineTotals({ 4: { sales: yen, profit: yen } }, { 4: { sales: -yen, profit: -yen } }, -1), /範囲/);
    assert.equal(costAccount(differenceOverflow).values[1][4], 0);
    assert.deepEqual(await api.readPlanContents(initiativeBytes), contents, "集計や失敗で保存値を変更しない");
    assert.equal(api.formatYen(yen), `${sign < 0 ? "-" : ""}9,007,199,254,741`);
    assert.equal(api.formatTableYen(sign * 499), "");
    assert.equal(api.formatYen(sign * 500), sign < 0 ? "-1" : "1");
  }
  assert.equal(api.addAmounts(0.1, 0.2), 0.3);
  assert.equal(api.addYen(api.amountToYen("0.1"), api.amountToYen("0.2")), 300);
  console.log("PASS: signed maximum yen readback, all tables, periods, exact differences, overflow and display-only rounding");
}
