import type { Database } from "./sqliteRuntime";
import type { MasterRow } from "../domain/masterRows";
import { masterRowKey } from "../domain/masterRows";
export function readMasterPresentation(db: Database) {
  const order: MasterRow[] = (db.exec("SELECT account_id, aggregation_group_id FROM master_order ORDER BY position")[0]?.values ?? [])
    .map(([account, group]) => ({kind: account === null ? "group" : "account", id:Number(account ?? group)}));
  return {order, ranks:new Map(order.map((row,index) => [masterRowKey(row),index]))};
}
export function saveMasterOrder(db: Database, order: MasterRow[]) {
  const positions = db.exec("SELECT position FROM master_order ORDER BY position")[0]?.values ?? [];
  if (JSON.stringify(readMasterPresentation(db).order) === JSON.stringify(order)
    && positions.every(([position], index) => position === index)) return;
  db.run("DELETE FROM master_order");
  order.forEach((row,position) => db.run("INSERT INTO master_order(position,account_id,aggregation_group_id) VALUES (?,?,?)",
    [position,row.kind === "account" ? row.id : null,row.kind === "group" ? row.id : null]));
}
export function reconcileMasterOrder(db: Database, before: MasterRow[]) {
  const all: MasterRow[] = [...(db.exec("SELECT id FROM accounts ORDER BY id")[0]?.values ?? []).map(([id]) => ({kind:"account" as const,id:Number(id)})),
    ...(db.exec("SELECT id FROM aggregation_groups ORDER BY id")[0]?.values ?? []).map(([id]) => ({kind:"group" as const,id:Number(id)}))];
  const remaining = new Set(all.map(masterRowKey));
  const order = before.filter(row => remaining.delete(masterRowKey(row)));
  saveMasterOrder(db,[...order,...all.filter(row => remaining.has(masterRowKey(row)))]);
}
export function validateMasterPresentation(db: Database) {
  const {order} = readMasterPresentation(db);
  const keys = new Set((db.exec("SELECT id FROM accounts")[0]?.values ?? []).map(([id]) => `account:${id}`));
  for (const [id] of db.exec("SELECT id FROM aggregation_groups")[0]?.values ?? []) keys.add(`group:${id}`);
  const positions = db.exec("SELECT position FROM master_order ORDER BY position")[0]?.values ?? [];
  if (order.length !== keys.size || positions.some(([position], index) => position !== index)
    || order.some(row => !Number.isSafeInteger(row.id) || !keys.delete(masterRowKey(row))) || keys.size) throw new Error("科目・集計の並び順が正しくありません。");
}
