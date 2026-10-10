import type { Database } from "./sqliteRuntime";
import { editDatabase } from "./transaction";
import { validateExpansionCategoryChange, type ExpansionCategory, type ExpansionCategoryChange } from "../domain/expansionCategoryMaster";
export function listExpansionCategories(database: Database): ExpansionCategory[] {
  return (database.exec("SELECT id, name FROM expansion_categories ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), categoryName: String(name) }));
}
export async function changeExpansionCategoryMaster(bytes: Uint8Array, change: ExpansionCategoryChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateExpansionCategoryChange(listExpansionCategories(database), change);
    if (change.type === "delete") {
      if (database.exec("SELECT expansion_id FROM expansion_category_assignments WHERE category_id = ? LIMIT 1", [change.id]).length) throw new Error("展開に割り当てている展開区分は削除できません。");
      if (database.exec("SELECT id FROM initiatives WHERE expansion_category_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の展開区分は削除できません。");
      database.run("DELETE FROM expansion_categories WHERE id = ?", [change.id]);
    } else if (change.type === "add") database.run("INSERT INTO expansion_categories (name) VALUES (?)", [change.categoryName.trim()]);
    else database.run("UPDATE expansion_categories SET name = ? WHERE id = ?", [change.categoryName.trim(), change.id]);
  })).bytes;
}
