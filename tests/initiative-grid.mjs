import assert from "node:assert/strict";

export function verifyInitiativeGrid(api) {
  const nonzero = { amounts: { 4: "100" } };
  const zero = { amounts: { 4: "0" } };
  assert.equal(api.canChangeAccountRow(zero, nonzero), false, "0化の保存待ち・保存中・失敗時は行操作を許可しない");
  assert.equal(api.canChangeAccountRow(zero, zero), true, "0化の保存成功後は行操作ができる");
  assert.equal(api.canChangeAccountRow({ ...zero, overrides: { 2: { 4: "1" } } }, zero), false, "手修正に非0が残る場合は禁止");
  assert.equal(api.canChangeAccountRow(zero), true, "新規行は入力の0で判断する");
  const blank = api.createInitiativeDraft("2026");
  assert.equal(api.hasInitiativeDraftInput(blank), false);
  for (const change of [
    { name: " " }, { note: "備考だけ" }, { expansionId: 1 }, { departmentId: 1 }, { periodTypeId: 1 }, { industryId: 1 },
    { invalidNumbers: true }, { rows: [...blank.rows, { id: "extra", accountId: null, amounts: {} }] },
    { rows: [{ ...blank.rows[0], accountId: 1 }] },
    { rows: [{ ...blank.rows[0], amounts: { 4: "0" } }] },
    { rows: [{ ...blank.rows[0], overrides: { 2: { 4: "0" } } }] },
  ]) assert.equal(api.hasInitiativeDraftInput({ ...blank, ...change }), true, "名称以外の入力と手修正0も破棄確認の対象");
  assert.equal(api.hasInitiativeDraftInput({ ...blank, rows: [{ ...blank.rows[0], amounts: { 4: "" } }] }), false);
  const draft = { name: "範囲入力", note: "", expansionId: 1, industryId: 1, departmentId: 1, fiscalYear: "2026",
    rows: [
      { id: 1, accountId: 1, amounts: { 4: "7", 5: "8", 10: "9", 3: "10" }, overrides: { 2: { 6: "11" } } },
      { id: 2, accountId: 1, amounts: { 4: "12", 5: "13" } },
      { id: "unassigned", accountId: null, amounts: {} },
    ] };
  const before = structuredClone(draft);
  for (const kind of [0, 3, 4, 5]) assert.throws(() => api.pasteInitiativeGrid(draft, kind, { row: 0, column: 0 }, "1"), /種別/);
  const selection = { anchor: { row: 1, column: 1 }, end: { row: 0, column: 0 } };
  const pasted = api.pasteInitiativeGrid(draft, 1, { row: 0, column: 0 }, "1,200.125\t-0.001\r\n\t0\r\n");
  assert.equal(pasted.rows[0].amounts[4], "1200.125");
  assert.equal(pasted.rows[0].amounts[5], "-0.001");
  assert.equal(pasted.rows[1].amounts[4], "0", "同じ科目の別行を独立して更新する");
  assert.equal(pasted.rows[0].amounts[10], "9");
  assert.deepEqual(pasted.rows[0].overrides, draft.rows[0].overrides);
  const filled = api.fillInitiativeGrid(draft, 2, selection, "0");
  for (const row of filled.rows.slice(0, 2)) {
    assert.equal(row.overrides[2][4], "0");
    assert.equal(row.overrides[2][5], "0");
  }
  assert.equal(filled.rows[0].overrides[2][6], "11");
  assert.equal(filled.rows[0].amounts[4], "7");
  assert.equal(api.resolvedAmount(filled.rows[0], 2, 4), "0", "手修正した0は引き継ぎへ伝わる");
  const reflected = api.reflectPrimaryBudget(filled);
  for (let index = 0; index < filled.rows.length; index++) {
    assert.deepEqual(reflected.rows[index].amounts, filled.rows[index].amounts, "一次予算を変更しない");
    assert.equal(reflected.rows[index].overrides[2], undefined, "全行・全月の手修正と手修正0を解除する");
    for (const month of [4, 5, 6, 10, 3]) assert.equal(api.resolvedAmount(reflected.rows[index], 2, month), api.resolvedAmount(reflected.rows[index], 1, month));
  }
  assert.equal(filled.rows[0].overrides[2][4], "0", "反映前の入力を保持する");
  reflected.rows[0].amounts = { ...reflected.rows[0].amounts, 4: "20" };
  assert.equal(api.resolvedAmount(reflected.rows[0], 2, 4), "20", "反映後も一次予算へ追従する");
  assert.deepEqual(api.reflectPrimaryBudget(api.reflectPrimaryBudget(draft)), api.reflectPrimaryBudget(draft));
  const late = api.pasteInitiativeGrid(draft, 2, { row: 0, column: 6 }, "15\t-0.001");
  assert.equal(late.rows[0].overrides[2][10], "15");
  assert.equal(late.rows[0].overrides[2][11], "-0.001");
  for (const text of ["1\t2\n3\t不正", "1\t2\n3", "1.0001", "12,34", "=1+2", "1e3"]) {
    assert.throws(() => api.pasteInitiativeGrid(draft, 1, { row: 0, column: 0 }, text));
  }
  assert.throws(() => api.pasteInitiativeGrid(draft, 1, { row: 1, column: 0 }, "1\n2"), /勘定科目/);
  assert.throws(() => api.pasteInitiativeGrid(draft, 1, { row: 0, column: 11 }, "1\t2"), /外/);
  assert.throws(() => api.pasteInitiativeGrid(draft, 1, { row: 2, column: 0 }, "1\n2"), /外/);
  assert.throws(() => api.fillInitiativeGrid(draft, 1, { anchor: { row: -1, column: 0 }, end: { row: 0, column: 0 } }, "0"), /外/);
  const accounts = ["sales", "cost", "expense", "profit", null].map((accountType, index) => ({ id: index + 1, accountType }));
  const summaryDraft = { ...draft, rows: [
    { accountId: 1, amounts: { 4: "1.125", 5: "-1" }, overrides: { 2: { 4: "0" } } },
    { accountId: 1, amounts: { 4: "2.375" } },
    { accountId: 2, amounts: { 4: "-4.001" } },
    { accountId: 3, amounts: {} },
    { accountId: 5, amounts: { 4: "900" } },
    { accountId: null, amounts: { 4: "800" } },
  ] };
  const primaryTotals = api.initiativeAttributeTotals(summaryDraft, 1, accounts);
  assert.equal(primaryTotals.error, "");
  assert.deepEqual(primaryTotals.rows.map(row => row.attribute), ["sales", "cost", "expense"], "入力行にない属性と未設定属性は表示しない");
  assert.equal(primaryTotals.rows[0].amounts[4], 3500, "重複科目も円の整数で合算し、丸めは表示時だけ行う");
  assert.equal(primaryTotals.rows[1].amounts[4], -4001, "売上原価も符号を反転せず属性内で合算する");
  assert.equal(primaryTotals.rows[2].amounts[4], 0, "存在する属性は全月0でも表示する");
  const confirmedTotals = api.initiativeAttributeTotals(summaryDraft, 2, accounts);
  assert.equal(confirmedTotals.rows[0].amounts[4], 2375, "確定予算は手修正0と引き継ぎを反映する");
  const invalid = api.initiativeAttributeTotals({ ...summaryDraft, rows: [{ accountId: 1, amounts: { 4: "不正" } }] }, 1, accounts);
  assert.equal(invalid.rows[0].amounts[4], undefined);
  assert.equal(invalid.rows[0].amounts[5], 0);
  assert.ok(invalid.error);
  const max = "9007199254740.991";
  const large = { ...draft, rows: [max, max, `-${max}`].map(amount => ({ accountId: 1, amounts: { 4: amount } })) };
  assert.equal(api.initiativeAttributeTotals(large, 1, accounts).rows[0].amounts[4], Number.MAX_SAFE_INTEGER, "途中の合計で丸めず相殺後を検証する");
  const overflow = api.initiativeAttributeTotals({ ...large, rows: large.rows.slice(0, 2) }, 1, accounts);
  assert.equal(overflow.rows[0].amounts[4], undefined);
  assert.match(overflow.error, /範囲/);
  assert.equal(api.initiativeAttributeTotals({ ...summaryDraft, invalidNumbers: true }, 1, accounts).rows[0].amounts[4], undefined);
  assert.deepEqual(api.initiativeAttributeTotals(blank, 1, accounts).rows, []);
  assert.deepEqual(draft, before, "成功・失敗とも入力元を変更しない");
  console.log("PASS: 施策の範囲入力、複数行の貼り付け、手修正0、精度と編集禁止セルの保護");
}
