import { type Database } from "sql.js";
import { INITIAL_PERIOD_TYPES } from "./periodMasterSchema";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type PeriodType = { id: number; periodName: string };
export type PeriodTypeChange =
  | { type: "add"; periodName: string }
  | { type: "update"; id: number; periodName: string }
  | { type: "delete"; id: number };

export function listPeriodTypes(database: Database): PeriodType[] {
  if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 9) return INITIAL_PERIOD_TYPES.map(item => ({ ...item }));
  return (database.exec("SELECT id, name FROM period_types ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), periodName: String(name) }));
}

export function validatePeriodTypeChange(items: PeriodType[], change: PeriodTypeChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("期間が見つかりません。");
  if (change.type === "delete") return;
  const name = change.periodName.trim();
  if (!name) throw new Error("期間名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.periodName === name)) throw new Error("同じ期間名が登録されています。");
}

export async function changePeriodMaster(bytes: Uint8Array, change: PeriodTypeChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validatePeriodTypeChange(listPeriodTypes(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE period_type_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の期間は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM period_types WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO period_types (name) VALUES (?)", [change.periodName.trim()]);
    else database.run("UPDATE period_types SET name = ? WHERE id = ?", [change.periodName.trim(), change.id]);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
