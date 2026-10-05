import { type Database } from "sql.js";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { isAccountType, type AccountType } from "./accountTypes";
import { hasColumn, migrateTriadicDatabase } from "./triadicMigration";

export type Account = { id: number; accountCode: string | null; accountName: string; accountType: AccountType | null; inUse: boolean };
export type AccountChange =
  | { type: "add"; accountCode: string; accountName: string; accountType: AccountType | "" }
  | { type: "update"; id: number; accountCode: string; accountName: string; accountType: AccountType | "" }
  | { type: "reorder"; ids: number[] }
  | { type: "delete"; id: number };

export function listAccounts(database: Database): Account[] {
  const code = hasColumn(database, "accounts", "code") ? "code" : "NULL";
  const hasType = hasColumn(database, "accounts", "attribute");
  const rowUsage = hasType ? "OR EXISTS(SELECT 1 FROM initiative_rows WHERE account_id = accounts.id)" : "";
  const manualOrder = Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) >= 3;
  const groupUsage = manualOrder ? "OR EXISTS(SELECT 1 FROM aggregation_members WHERE account_id = accounts.id)" : "";
  return (database.exec(`SELECT id, ${code} AS account_code, name, ${hasType ? "attribute" : "NULL"},
    EXISTS(SELECT 1 FROM details WHERE account_id = accounts.id) ${rowUsage} ${groupUsage} OR EXISTS(SELECT 1 FROM previous_amounts WHERE account_id = accounts.id)
    FROM accounts WHERE budget_id = 1 ORDER BY ${manualOrder ? "sort_order, id" : "account_code IS NULL, account_code, sort_order, id"}`)[0]?.values ?? [])
    .map(([id, accountCode, accountName, accountType, inUse]) => ({ id: Number(id), accountCode: accountCode === null ? null : String(accountCode), accountName: String(accountName), accountType: isAccountType(accountType) ? accountType : null, inUse: Boolean(inUse) }));
}

export async function readAccountMaster(bytes: Uint8Array): Promise<Account[]> {
  const database = await openTriadicDatabase(bytes);
  try { return listAccounts(database); }
  finally { database.close(); }
}

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
export async function changeAccountMaster(bytes: Uint8Array, change: AccountChange) {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateAccountChange(listAccounts(database), change);
    if (change.type === "reorder") {
      change.ids.forEach((id, index) => database.run("UPDATE accounts SET sort_order = ? WHERE budget_id = 1 AND id = ?", [index, id]));
    } else if (change.type === "delete") {
      database.run("DELETE FROM accounts WHERE budget_id = 1 AND id = ?", [change.id]);
    } else {
      const code = change.accountCode.trim();
      const name = change.accountName.trim();
      if (change.type === "add") {
        database.run(`INSERT INTO accounts (budget_id, code, name, attribute, sort_order)
          VALUES (1, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts WHERE budget_id = 1))`, [code, name, change.accountType]);
      } else {
        database.run("UPDATE accounts SET code = ?, name = ?, attribute = ? WHERE budget_id = 1 AND id = ?", [code, name, change.accountType, change.id]);
      }
    }
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return { accounts: listAccounts(database), bytes: exportTriadicDatabase(database) };
  } finally { database.close(); }
}
