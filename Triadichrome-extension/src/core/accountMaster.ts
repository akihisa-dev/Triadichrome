import { type Database } from "sql.js";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { ACCOUNT_CODE_COLUMN_SQL } from "./triadicSchema";

export type Account = { id: number; accountCode: string | null; accountName: string; inUse: boolean };
export type AccountChange =
  | { type: "add"; accountCode: string; accountName: string }
  | { type: "update"; id: number; accountCode: string; accountName: string }
  | { type: "delete"; id: number };

function hasAccountCode(database: Database): boolean {
  return database.exec("PRAGMA table_info(accounts)")[0]!.values.some(column => column[1] === "code");
}

function listAccounts(database: Database): Account[] {
  const code = hasAccountCode(database) ? "code" : "NULL";
  return (database.exec(`SELECT id, ${code} AS account_code, name,
    EXISTS(SELECT 1 FROM details WHERE account_id = accounts.id)
    FROM accounts WHERE budget_id = 1 ORDER BY account_code IS NULL, account_code, sort_order, id`)[0]?.values ?? [])
    .map(([id, accountCode, accountName, inUse]) => ({ id: Number(id), accountCode: accountCode === null ? null : String(accountCode), accountName: String(accountName), inUse: Boolean(inUse) }));
}

export async function readAccountMaster(bytes: Uint8Array): Promise<Account[]> {
  const database = await openTriadicDatabase(bytes);
  try { return listAccounts(database); }
  finally { database.close(); }
}

export function validateAccountChange(accounts: Account[], change: AccountChange): void {
  const account = change.type === "add" ? undefined : accounts.find(item => item.id === change.id);
  if (change.type !== "add" && !account) throw new Error("勘定科目が見つかりません。");
  if (change.type === "delete") {
    if (account?.inUse) throw new Error("明細で使用している勘定科目は削除できません。");
    return;
  }
  const code = change.accountCode.trim();
  const name = change.accountName.trim();
  if (!/^[0-9]{3}$/.test(code)) throw new Error("科目コードは半角数字3桁で入力してください。");
  if (!name) throw new Error("科目名を入力してください。");
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
    // Additive migration on the copy being saved; reading old files never rewrites them.
    if (!hasAccountCode(database)) database.run(`ALTER TABLE accounts ADD COLUMN ${ACCOUNT_CODE_COLUMN_SQL}`);
    database.run("CREATE UNIQUE INDEX IF NOT EXISTS accounts_code_idx ON accounts (budget_id, code)");
    validateAccountChange(listAccounts(database), change);
    if (change.type === "delete") {
      database.run("DELETE FROM accounts WHERE budget_id = 1 AND id = ?", [change.id]);
    } else {
      const code = change.accountCode.trim();
      const name = change.accountName.trim();
      if (change.type === "add") {
        database.run(`INSERT INTO accounts (budget_id, code, name, sort_order)
          VALUES (1, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts WHERE budget_id = 1))`, [code, name]);
      } else {
        database.run("UPDATE accounts SET code = ?, name = ? WHERE budget_id = 1 AND id = ?", [code, name, change.id]);
      }
    }
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return { accounts: listAccounts(database), bytes: exportTriadicDatabase(database) };
  } finally { database.close(); }
}
