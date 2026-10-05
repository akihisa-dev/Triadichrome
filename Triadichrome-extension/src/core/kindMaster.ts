import { type Database } from "sql.js";
import { INITIAL_KINDS } from "./kindMasterSchema";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type Kind = { id: number; kindName: string };
export type KindChange =
  | { type: "add"; kindName: string }
  | { type: "update"; id: number; kindName: string }
  | { type: "delete"; id: number };

export function listKinds(database: Database): Kind[] {
  if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 12) return INITIAL_KINDS.map(item => ({ ...item }));
  return (database.exec("SELECT id, name FROM kind_types ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), kindName: String(name) }));
}

export function validateKindChange(items: Kind[], change: KindChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("種別が見つかりません。");
  if (change.type === "delete") return;
  const name = change.kindName.trim();
  if (!name) throw new Error("種別を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.kindName === name)) throw new Error("同じ種別が登録されています。");
}

export async function changeKindMaster(bytes: Uint8Array, change: KindChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateKindChange(listKinds(database), change);
    if (change.type === "delete") database.run("DELETE FROM kind_types WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO kind_types (name) VALUES (?)", [change.kindName.trim()]);
    else database.run("UPDATE kind_types SET name = ? WHERE id = ?", [change.kindName.trim(), change.id]);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
