import { type Database } from "sql.js";
import { INITIAL_EXPANSIONS } from "./expansionSchema";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type Expansion = { id: number; expansionCode: string; expansionName: string };
export type ExpansionChange =
  | { type: "add"; expansionCode: string; expansionName: string }
  | { type: "update"; id: number; expansionCode: string; expansionName: string }
  | { type: "delete"; id: number };

export function listExpansions(database: Database): Expansion[] {
  if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 4) return INITIAL_EXPANSIONS.map(item => ({ ...item }));
  return (database.exec("SELECT id, code, name FROM expansions ORDER BY length(code), code, id")[0]?.values ?? [])
    .map(([id, code, name]) => ({ id: Number(id), expansionCode: String(code), expansionName: String(name) }));
}

export function validateExpansionChange(items: Expansion[], change: ExpansionChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("展開が見つかりません。");
  if (change.type === "delete") return;
  const code = change.expansionCode.trim();
  const name = change.expansionName.trim();
  if (!/^[0-9]+$/.test(code)) throw new Error("展開コードは半角数字で入力してください。");
  if (!name) throw new Error("展開名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.expansionCode === code)) throw new Error("同じ展開コードが登録されています。");
  if (others.some(item => item.expansionName === name)) throw new Error("同じ展開名が登録されています。");
}

export async function changeExpansionMaster(bytes: Uint8Array, change: ExpansionChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateExpansionChange(listExpansions(database), change);
    if (change.type === "delete") database.run("DELETE FROM expansions WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO expansions (code, name) VALUES (?, ?)", [change.expansionCode.trim(), change.expansionName.trim()]);
    else database.run("UPDATE expansions SET code = ?, name = ? WHERE id = ?", [change.expansionCode.trim(), change.expansionName.trim(), change.id]);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
