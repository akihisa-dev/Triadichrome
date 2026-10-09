import { readMasterPresentation, reconcileMasterOrder, saveAccountDisplayNames } from "./masterPresentation";
import { orderedMasterRows, validateMasterOrder } from "../domain/masterRows";
import { listAggregations } from "./aggregations";
import type { Database } from "./sqliteRuntime";
import { editDatabase } from "./transaction";
import { validateAccountChange, type Account, type AccountChange } from "../domain/accountMaster";
import { openTriadicDatabase } from "./triadicDatabase";
import { isAccountType } from "../domain/accountTypes";
export function listAccounts(database: Database): Account[] {
  const {names,ranks} = readMasterPresentation(database);
  return (database.exec(`SELECT id, code, name, attribute,
    EXISTS(SELECT 1 FROM initiative_rows WHERE account_id = accounts.id)
    OR EXISTS(SELECT 1 FROM aggregation_members WHERE account_id = accounts.id)
    OR EXISTS(SELECT 1 FROM previous_amounts WHERE account_id = accounts.id)
    FROM accounts ORDER BY sort_order, id`)[0]?.values ?? []).map(([id, code, name, attribute, inUse]) =>
      ({ ...(names[String(id)] ? {displayName:names[String(id)]} : {}), ...(ranks.has(`account:${id}`) ? {masterOrder:ranks.get(`account:${id}`)!} : {}), id: Number(id), accountCode: String(code), accountName: String(name), accountType: isAccountType(attribute) ? attribute : null, inUse: Boolean(inUse) }));
}

export async function readAccountMaster(bytes: Uint8Array): Promise<Account[]> {
  const database = await openTriadicDatabase(bytes);
  try { return listAccounts(database); }
  finally { database.close(); }
}

export async function changeAccountMaster(bytes: Uint8Array, change: AccountChange) {
  return await editDatabase(bytes, database => {
    const before = listAccounts(database);
    const presentation = readMasterPresentation(database);
    const order = change.presentationOrder ?? presentation.order ?? orderedMasterRows(before,listAggregations(database));
    if (change.presentationOrder) validateMasterOrder(change.presentationOrder,before,listAggregations(database));
    validateAccountChange(before, change);
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
    if (change.type === "delete") delete presentation.names[String(change.id)];
    else if (change.type !== "reorder") {
      const current = change.type === "update" ? before.find(item => item.id === change.id) : undefined;
      const id = current?.id ?? Number(database.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0]);
      const display = change.displayName?.trim() ?? (current?.displayName && current.displayName !== current.accountName ? current.displayName : change.accountName.trim());
      if (display === change.accountName.trim()) delete presentation.names[String(id)]; else presentation.names[String(id)] = display;
    }
    saveAccountDisplayNames(database,presentation.names);
    if ((presentation.order || change.presentationOrder) && change.type === "reorder") { let cursor=0; reconcileMasterOrder(database,order.map(row => row.kind === "account" ? {...row,id:change.ids[cursor++]!} : row)); }
    else if (presentation.order || change.presentationOrder) reconcileMasterOrder(database,order);
    return listAccounts(database);
  }).then(({ bytes, result }) => ({ bytes, accounts: result }));
}
