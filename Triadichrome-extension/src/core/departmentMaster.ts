import { type Database } from "sql.js";
import { INITIAL_DEPARTMENTS } from "./departmentSchema";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";

export type Department = { id: number; departmentName: string };
export type DepartmentChange =
  | { type: "add"; departmentName: string }
  | { type: "update"; id: number; departmentName: string }
  | { type: "delete"; id: number };

export function listDepartments(database: Database): Department[] {
  if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 8) return INITIAL_DEPARTMENTS.map(item => ({ ...item }));
  return (database.exec("SELECT id, name FROM departments ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), departmentName: String(name) }));
}

export function validateDepartmentChange(items: Department[], change: DepartmentChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("部署が見つかりません。");
  if (change.type === "delete") return;
  const name = change.departmentName.trim();
  if (!name) throw new Error("部署名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.departmentName === name)) throw new Error("同じ部署名が登録されています。");
}

export async function changeDepartmentMaster(bytes: Uint8Array, change: DepartmentChange): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateDepartmentChange(listDepartments(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の部署は削除できません。");
    if (change.type === "delete" && database.exec("SELECT account_id FROM previous_amounts WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("前年入力で使用中の部署は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM departments WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO departments (name) VALUES (?)", [change.departmentName.trim()]);
    else database.run("UPDATE departments SET name = ? WHERE id = ?", [change.departmentName.trim(), change.id]);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
