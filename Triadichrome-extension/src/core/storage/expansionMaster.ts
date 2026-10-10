import type { Database } from "./sqliteRuntime";
import { editDatabase } from "./transaction";
import { validateExpansionChange, type Expansion, type ExpansionChange } from "../domain/expansionMaster";
export function listExpansions(database: Database): Expansion[] {
  const assignments = new Map<number, number[]>();
  for (const [expansion, category] of database.exec("SELECT expansion_id, category_id FROM expansion_category_assignments ORDER BY category_id")[0]?.values ?? []) {
    const ids = assignments.get(Number(expansion)) ?? []; ids.push(Number(category)); assignments.set(Number(expansion), ids);
  }
  return (database.exec("SELECT id, code, name FROM expansions ORDER BY length(code), code, id")[0]?.values ?? [])
    .map(([id, code, name]) => ({ id: Number(id), expansionCode: String(code), expansionName: String(name), categoryIds: assignments.get(Number(id)) ?? [] }));
}

export async function changeExpansionMaster(bytes: Uint8Array, change: ExpansionChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateExpansionChange(listExpansions(database), change);
    if (change.type !== "delete" && change.categoryIds !== undefined) {
      const ids = change.categoryIds;
      if (new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || !database.exec("SELECT id FROM expansion_categories WHERE id = ?", [id]).length)) throw new Error("存在する展開区分を重複せずに選択してください。");
      if (change.type === "update" && (database.exec("SELECT expansion_category_id FROM initiatives WHERE expansion_id = ? AND expansion_category_id IS NOT NULL", [change.id])[0]?.values ?? []).some(([id]) => !ids.includes(Number(id)))) throw new Error("施策で使用中の展開区分は展開から外せません。");
    }
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE expansion_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用している展開名は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM expansions WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO expansions (code, name) VALUES (?, ?)", [change.expansionCode.trim(), change.expansionName.trim()]);
    else database.run("UPDATE expansions SET code = ?, name = ? WHERE id = ?", [change.expansionCode.trim(), change.expansionName.trim(), change.id]);
    if (change.type !== "delete" && change.categoryIds !== undefined) {
      const id = change.type === "update" ? change.id : Number(database.exec("SELECT id FROM expansions WHERE code = ?", [change.expansionCode.trim()])[0]!.values[0]![0]);
      const before = listExpansions(database).find(item => item.id === id)!.categoryIds ?? [];
      for (const category of before.filter(value => !change.categoryIds!.includes(value))) database.run("DELETE FROM expansion_category_assignments WHERE expansion_id = ? AND category_id = ?", [id, category]);
      for (const category of change.categoryIds.filter(value => !before.includes(value))) database.run("INSERT INTO expansion_category_assignments VALUES (?, ?)", [id, category]);
    }
  })).bytes;
}
