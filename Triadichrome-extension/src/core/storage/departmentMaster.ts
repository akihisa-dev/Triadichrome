import type { Database } from "sql.js";
import { editDatabase } from "./transaction";
import { validateDepartmentChange, type Department, type DepartmentChange } from "../domain/departmentMaster";
export function listDepartments(database: Database): Department[] {
  return (database.exec("SELECT id, name FROM departments ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), departmentName: String(name) }));
}

export async function changeDepartmentMaster(bytes: Uint8Array, change: DepartmentChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateDepartmentChange(listDepartments(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の部署は削除できません。");
    if (change.type === "delete" && database.exec("SELECT account_id FROM previous_amounts WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("前年入力で使用中の部署は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM departments WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO departments (name) VALUES (?)", [change.departmentName.trim()]);
    else database.run("UPDATE departments SET name = ? WHERE id = ?", [change.departmentName.trim(), change.id]);
  })).bytes;
}
