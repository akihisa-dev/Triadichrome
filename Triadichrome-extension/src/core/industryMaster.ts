import { type Database } from "sql.js";
import { INITIAL_INDUSTRIES } from "./industrySchema";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type Industry = { id: number; industryCode: string; industryName: string };
export type IndustryChange =
  | { type: "add"; industryCode: string; industryName: string }
  | { type: "update"; id: number; industryCode: string; industryName: string }
  | { type: "delete"; id: number };

export function listIndustries(database: Database): Industry[] {
  if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 5) return INITIAL_INDUSTRIES.map(item => ({ ...item }));
  return (database.exec("SELECT id, code, name FROM industries ORDER BY length(code), code, id")[0]?.values ?? [])
    .map(([id, code, name]) => ({ id: Number(id), industryCode: String(code), industryName: String(name) }));
}

export function validateIndustryChange(items: Industry[], change: IndustryChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("業種が見つかりません。");
  if (change.type === "delete") return;
  const code = change.industryCode.trim();
  const name = change.industryName.trim();
  if (!/^[0-9]+$/.test(code)) throw new Error("業種コードは半角数字で入力してください。");
  if (!name) throw new Error("業種名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.industryCode === code)) throw new Error("同じ業種コードが登録されています。");
  if (others.some(item => item.industryName === name)) throw new Error("同じ業種名が登録されています。");
}

export async function changeIndustryMaster(bytes: Uint8Array, change: IndustryChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateIndustryChange(listIndustries(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE industry_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用している業種は削除できません。");
    if (change.type === "delete" && database.exec("SELECT account_id FROM previous_amounts WHERE industry_id = ? LIMIT 1", [change.id]).length) throw new Error("前年入力で使用中の業種は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM industries WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO industries (code, name) VALUES (?, ?)", [change.industryCode.trim(), change.industryName.trim()]);
    else database.run("UPDATE industries SET code = ?, name = ? WHERE id = ?", [change.industryCode.trim(), change.industryName.trim(), change.id]);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
