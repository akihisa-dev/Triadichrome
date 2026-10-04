import { listAccounts, type Account } from "./accountMaster";
import { listAggregations, validateAggregations, type Aggregation, type AggregationMember } from "./aggregations";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type AggregationChange =
  | { type: "add"; name: string }
  | { type: "update"; id: number; name: string; members: AggregationMember[] }
  | { type: "delete"; id: number };

export function changedAggregations(groups: Aggregation[], accounts: Account[], change: AggregationChange): Aggregation[] {
  let next: Aggregation[];
  if (change.type === "add") {
    next = [...groups, { id: Math.max(0, ...groups.map(group => group.id)) + 1, name: change.name.trim(), required: null, members: [] }];
  } else {
    const current = groups.find(group => group.id === change.id);
    if (!current) throw new Error("集計が見つかりません。");
    if (change.type === "delete") {
      if (current.required) throw new Error("必須集計は削除できません。");
      if (current.members.length || groups.some(group => group.members.some(member => member.kind === "group" && member.id === current.id))) throw new Error("使用中の集計は削除できません。先に所属を解除してください。");
      next = groups.filter(group => group.id !== current.id);
    } else next = groups.map(group => group.id === current.id ? { ...group, name: change.name.trim(), members: change.members } : group);
  }
  validateAggregations(next, new Set(accounts.map(account => account.id)));
  return next;
}

export async function changeAggregationMaster(bytes: Uint8Array, change: AggregationChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    const next = changedAggregations(listAggregations(database), listAccounts(database), change);
    database.run("BEGIN");
    if (change.type === "add") {
      const added = next[next.length - 1]!;
      database.run("INSERT INTO aggregation_groups (id, name, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM aggregation_groups))", [added.id, added.name]);
    } else if (change.type === "delete") database.run("DELETE FROM aggregation_groups WHERE id = ?", [change.id]);
    else {
      database.run("UPDATE aggregation_groups SET name = ? WHERE id = ?", [change.name.trim(), change.id]);
      database.run("DELETE FROM aggregation_members WHERE parent_id = ?", [change.id]);
      change.members.forEach((member, position) => database.run("INSERT INTO aggregation_members (parent_id, account_id, group_id, sign, position) VALUES (?, ?, ?, ?, ?)",
        [change.id, member.kind === "account" ? member.id : null, member.kind === "group" ? member.id : null, member.sign, position]));
    }
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
