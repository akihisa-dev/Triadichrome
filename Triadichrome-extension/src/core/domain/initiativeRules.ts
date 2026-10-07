import { currentFiscalYear, initiativeMonths, type InitiativeMonth } from "./calendar";
import type { InitiativeEntryDraft, Initiative } from "./plan";
import type { Account } from "./accountMaster";
import type { Expansion } from "./expansionMaster";
import type { Industry } from "./industryMaster";
import type { Department } from "./departmentMaster";
import type { PeriodType } from "./periodMaster";
import { isValidAmount } from "./amounts";
export function createInitiativeDraft(fiscalYear = String(currentFiscalYear())): InitiativeEntryDraft {
  return { name: "", note: "", expansionId: null, departmentId: null, periodTypeId: null, industryId: null, fiscalYear, rows: [{ id: crypto.randomUUID(), accountId: null, amounts: {} }] };
}

export function validateInitiative(draft: InitiativeEntryDraft, accounts: Account[], initiatives: Initiative[], expansions: Expansion[], departments: Department[] = [], periodTypes: PeriodType[] = [], industries: Industry[] = [], allowEmptyRows = false): void {
  if (draft.invalidNumbers) throw new Error("年度・金額に有効な数値を入力してください。");
  if (!draft.name.trim()) throw new Error("施策名を入力してください。");
  if (!expansions.some(item => item.id === draft.expansionId)) throw new Error("展開名を選択してください。");
  if (!departments.some(item => item.id === draft.departmentId)) throw new Error("部署名を選択してください。");
  if (draft.periodTypeId != null && !periodTypes.some(item => item.id === draft.periodTypeId)) throw new Error("期間名を選択してください。");
  if (!industries.some(item => item.id === draft.industryId)) throw new Error("業種名を選択してください。");
  const year = Number(draft.fiscalYear);
  if (!/^\d{1,4}$/.test(draft.fiscalYear) || !Number.isInteger(year) || year < 1 || year > 9998) throw new Error("年度は1〜9998の整数で入力してください。");
  if (initiatives.some(item => item.name === draft.name.trim())) throw new Error("同じ施策名が登録されています。別の名前を入力してください。");
  if (!allowEmptyRows && !draft.rows.some(row => row.accountId !== null)) throw new Error("勘定科目を一つ以上選択してください。");
  draft.rows.forEach((row, index) => {
    const hasAmount = Object.values(row.amounts).some(value => value !== "");
    if (row.accountId === null && !hasAmount) return;
    const account = accounts.find(item => item.id === row.accountId);
    if (!account) throw new Error(`${index + 1}行目の勘定科目を選択してください。`);
    if (!account.accountType) throw new Error(`「${account.accountName}」の科目属性をマスタで設定してください。`);
    const values = [row.amounts, ...Object.values(row.overrides ?? {})];
    for (const [month, amount] of values.flatMap(values => Object.entries(values))) {
      if (!initiativeMonths.includes(Number(month) as InitiativeMonth)) throw new Error("対象月が正しくありません。");
      if (amount !== "" && !isValidAmount(amount)) throw new Error(`${index + 1}行目の${month}月に有効な金額を千円単位・小数点以下3桁までで入力してください。`);
    }
    for (const kind of Object.keys(row.overrides ?? {})) {
      if (![2].includes(Number(kind))) throw new Error("種別が正しくありません。");
    }
  });
}
