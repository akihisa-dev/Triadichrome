import { isAccountType, type AccountType } from "./accountTypes";
export type Account = { id: number; accountCode: string | null; accountName: string; accountType: AccountType | null; inUse: boolean };
export type AccountChange =
  | { type: "add"; accountCode: string; accountName: string; accountType: AccountType | "" }
  | { type: "update"; id: number; accountCode: string; accountName: string; accountType: AccountType | "" }
  | { type: "reorder"; ids: number[] }
  | { type: "delete"; id: number };

export function validateAccountChange(accounts: Account[], change: AccountChange): void {
  if (change.type === "reorder") {
    const ids = new Set(change.ids);
    if (ids.size !== accounts.length || change.ids.length !== accounts.length || accounts.some(account => !ids.has(account.id))) throw new Error("並べ替える科目が一致しません。");
    return;
  }
  const account = change.type === "add" ? undefined : accounts.find(item => item.id === change.id);
  if (change.type !== "add" && !account) throw new Error("勘定科目が見つかりません。");
  if (change.type === "delete") {
    if (account?.inUse) throw new Error("施策・明細・集計で使用している勘定科目は削除できません。");
    return;
  }
  const code = change.accountCode.trim();
  const name = change.accountName.trim();
  if (!/^[0-9]{3}$/.test(code)) throw new Error("科目コードは半角数字3桁で入力してください。");
  if (!name) throw new Error("科目名を入力してください。");
  if (!isAccountType(change.accountType)) throw new Error("科目属性を選択してください。");
  if (accounts.some(item => item.accountCode === code && item.id !== account?.id)) {
    throw new Error("同じ科目コードが登録されています。");
  }
  if (accounts.some(item => item.accountName === name && item.id !== account?.id)) {
    throw new Error("同じ名前の勘定科目が登録されています。");
  }
}

/** Work on a copy; callers publish the result only after a successful file write. */
