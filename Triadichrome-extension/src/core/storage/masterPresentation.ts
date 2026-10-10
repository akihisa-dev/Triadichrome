import type { Database } from "./sqliteRuntime";
import type { MasterRow } from "../domain/masterRows";
import { masterRowKey } from "../domain/masterRows";
export function readMasterPresentation(db: Database) {
  const metadata = new Map((db.exec("SELECT key, value FROM triadic_metadata WHERE key IN ('master_order', 'account_display_names')")[0]?.values ?? []).map(([key,value]) => [String(key),String(value)]));
  const order: MasterRow[] | undefined = metadata.has("master_order") ? JSON.parse(metadata.get("master_order")!) : undefined;
  const names: Record<string,string> = metadata.has("account_display_names") ? JSON.parse(metadata.get("account_display_names")!) : {};
  return {order,names, ranks:new Map(order?.map((row,index) => [masterRowKey(row),index]))};
}
export function saveMasterOrder(db: Database, order: MasterRow[]) {
  const serialized = JSON.stringify(order);
  if (db.exec("SELECT value FROM triadic_metadata WHERE key = 'master_order'")[0]?.values[0]?.[0] === serialized) return;
  db.run("INSERT OR REPLACE INTO triadic_metadata (key,value) VALUES ('master_order', ?)", [serialized]);
  // Existing account-only consumers use the account subsequence of the same master.
  let accountIndex=0, groupIndex=0;
  for (const row of order) db.run(`UPDATE ${row.kind === "account" ? "accounts" : "aggregation_groups"} SET sort_order = ? WHERE id = ?`, [row.kind === "account" ? accountIndex++ : groupIndex++, row.id]);
}
export function reconcileMasterOrder(db: Database, before: MasterRow[]) {
  const all: MasterRow[] = [...(db.exec("SELECT id FROM accounts ORDER BY sort_order,id")[0]?.values ?? []).map(([id]) => ({kind:"account" as const,id:Number(id)})), ...(db.exec("SELECT id FROM aggregation_groups ORDER BY sort_order,id")[0]?.values ?? []).map(([id]) => ({kind:"group" as const,id:Number(id)}))];
  const existing = new Set(all.map(masterRowKey));
  const order = before.filter(row => existing.delete(masterRowKey(row)));
  saveMasterOrder(db,[...order,...all.filter(row => existing.has(masterRowKey(row)))]);
}
export function saveAccountDisplayNames(db: Database, names: Record<string,string>) {
  db.run("INSERT OR REPLACE INTO triadic_metadata (key,value) VALUES ('account_display_names', ?)", [JSON.stringify(names)]);
}
export function validateMasterPresentation(db: Database) {
  const {order,names} = readMasterPresentation(db);
  const accounts = new Set((db.exec("SELECT id FROM accounts")[0]?.values ?? []).map(([id]) => Number(id)));
  const keys = new Set([...accounts].map(id => `account:${id}`));
  for (const [id] of db.exec("SELECT id FROM aggregation_groups")[0]?.values ?? []) keys.add(`group:${id}`);
  if (order !== undefined && (!Array.isArray(order) || order.length !== keys.size || order.some(row => !row || !Number.isSafeInteger(row.id) || !keys.delete(masterRowKey(row))) || keys.size)) throw new Error("科目・集計の並び順が正しくありません。");
  if (!names || typeof names !== "object" || Array.isArray(names) || Object.entries(names).some(([id,name]) => !accounts.has(Number(id)) || String(Number(id)) !== id || typeof name !== "string" || !name.trim())) throw new Error("科目の表示名が正しくありません。");
}
