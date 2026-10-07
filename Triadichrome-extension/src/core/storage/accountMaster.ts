import type { Database } from "sql.js";
import { editDatabase } from "./transaction";
import { validateAccountChange, type Account, type AccountChange } from "../domain/accountMaster";
import { openTriadicDatabase } from "./triadicDatabase";
import { isAccountType } from "../domain/accountTypes";
export function listAccounts(database: Database): Account[] {
  return (database.exec(`SELECT id, code, name, attribute,
    EXISTS(SELECT 1 FROM initiative_rows WHERE account_id = accounts.id)
    OR EXISTS(SELECT 1 FROM aggregation_members WHERE account_id = accounts.id)
    OR EXISTS(SELECT 1 FROM previous_amounts WHERE account_id = accounts.id)
    FROM accounts ORDER BY sort_order, id`)[0]?.values ?? []).map(([id, code, name, attribute, inUse]) =>
      ({ id: Number(id), accountCode: String(code), accountName: String(name), accountType: isAccountType(attribute) ? attribute : null, inUse: Boolean(inUse) }));
}

export async function readAccountMaster(bytes: Uint8Array): Promise<Account[]> {
  const database = await openTriadicDatabase(bytes);
  try { return listAccounts(database); }
  finally { database.close(); }
}

export async function changeAccountMaster(bytes: Uint8Array, change: AccountChange) {
  return await editDatabase(bytes, database => {
    validateAccountChange(listAccounts(database), change);
    if (change.type === "reorder") {
      change.ids.forEach((id, index) => database.run("UPDATE accounts SET sort_order = ? WHERE id = ?", [index, id]));
    } else if (change.type === "delete") {
      database.run("DELETE FROM accounts WHERE id = ?", [change.id]);
    } else {
      const code = change.accountCode.trim();
      const name = change.accountName.trim();
      if (change.type === "add") {
        database.run(`INSERT INTO accounts (code, name, attribute, sort_order)
          VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts))`, [code, name, change.accountType]);
      } else {
        database.run("UPDATE accounts SET code = ?, name = ?, attribute = ? WHERE id = ?", [code, name, change.accountType, change.id]);
      }
    }
    return listAccounts(database);
  }).then(({ bytes, result }) => ({ bytes, accounts: result }));
}
