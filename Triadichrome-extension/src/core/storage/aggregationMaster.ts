import { orderedMasterRows, validateMasterOrder } from "../domain/masterRows";
import { readMasterPresentation, reconcileMasterOrder, saveMasterOrder } from "./masterPresentation";
import { listAccounts } from "./accountMaster";
import { listAggregations } from "./aggregations";
import { changedAggregations, type AggregationChange } from "../domain/aggregationMaster";
import { editDatabase } from "./transaction";
import type { Database } from "./sqliteRuntime";
export async function changeAggregationMaster(bytes: Uint8Array, change: AggregationChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => applyAggregationChange(database, change))).bytes;
}
/** Operates only on the caller’s private, validated connection. */
export function applyAggregationChange(database: Database, change: AggregationChange): void {
    const accounts = listAccounts(database), groups = listAggregations(database);
    const order = change.presentationOrder ?? orderedMasterRows(accounts,groups);
    if (change.presentationOrder) validateMasterOrder(change.presentationOrder,accounts,groups);
    const next = changedAggregations(groups, accounts, change);
    if (change.type === "reorder") { saveMasterOrder(database,change.order); return; }
    if (change.type === "add") {
      const added = next[next.length - 1]!;
      database.run("INSERT INTO aggregation_groups (id, name, display_name, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM aggregation_groups))", [added.id, added.name, added.displayName ?? null]);
    } else if (change.type === "delete") database.run("DELETE FROM aggregation_groups WHERE id = ?", [change.id]);
    else if (change.type === "move") {
      const { member, parentId, sign } = change;
      const currentParent = groups.find(group => group.members.some(item => item.kind === member.kind && item.id === member.id));
      if (parentId !== null && currentParent?.id === parentId) {
        database.run(`UPDATE aggregation_members SET sign = ? WHERE ${member.kind === "account" ? "account_id" : "group_id"} = ?`, [sign, member.id]);
      } else {
        database.run(member.kind === "account" ? "DELETE FROM aggregation_members WHERE account_id = ?" : "DELETE FROM aggregation_members WHERE group_id = ?", [member.id]);
        if (parentId !== null) database.run("INSERT INTO aggregation_members (parent_id, account_id, group_id, sign, position) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM aggregation_members WHERE parent_id = ?))",
          [parentId, member.kind === "account" ? member.id : null, member.kind === "group" ? member.id : null, sign, parentId]);
      }
    } else {
      const updated = next.find(group => group.id === change.id)!;
      database.run("UPDATE aggregation_groups SET name = ?, display_name = ? WHERE id = ?", [updated.name, updated.displayName ?? null, change.id]);
      database.run("DELETE FROM aggregation_members WHERE parent_id = ?", [change.id]);
      change.members.forEach((member, position) => database.run("INSERT INTO aggregation_members (parent_id, account_id, group_id, sign, position) VALUES (?, ?, ?, ?, ?)",
        [change.id, member.kind === "account" ? member.id : null, member.kind === "group" ? member.id : null, member.sign, position]));
    }
    if (readMasterPresentation(database).order || change.presentationOrder) reconcileMasterOrder(database,order);
}
