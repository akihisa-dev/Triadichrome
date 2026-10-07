import type { Database } from "./sqliteRuntime";
import { editDatabase } from "./transaction";
import { validateExpansionChange, type Expansion, type ExpansionChange } from "../domain/expansionMaster";
export function listExpansions(database: Database): Expansion[] {
  return (database.exec("SELECT id, code, name FROM expansions ORDER BY length(code), code, id")[0]?.values ?? [])
    .map(([id, code, name]) => ({ id: Number(id), expansionCode: String(code), expansionName: String(name) }));
}

export async function changeExpansionMaster(bytes: Uint8Array, change: ExpansionChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateExpansionChange(listExpansions(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE expansion_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用している展開名は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM expansions WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO expansions (code, name) VALUES (?, ?)", [change.expansionCode.trim(), change.expansionName.trim()]);
    else database.run("UPDATE expansions SET code = ?, name = ? WHERE id = ?", [change.expansionCode.trim(), change.expansionName.trim(), change.id]);
  })).bytes;
}
