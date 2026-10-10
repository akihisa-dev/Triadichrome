import { classificationIdentity, identifyNewClassification } from "./classificationIdentity";
import type { Database } from "./sqliteRuntime";
import { editDatabase } from "./transaction";
import { validateDepartmentChange, type Department, type DepartmentChange } from "../domain/departmentMaster";
export function listDepartments(database: Database): Department[] {
  const memberships = new Map<number, number[]>();
  for (const [department, industry] of database.exec("SELECT department_id, industry_id FROM department_industries ORDER BY industry_id")[0]?.values ?? []) {
    const ids = memberships.get(Number(department)) ?? []; ids.push(Number(industry)); memberships.set(Number(department), ids);
  }
  return (database.exec("SELECT id, name FROM departments ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), identity: classificationIdentity(database, "departments", Number(id)), departmentName: String(name), industryIds: memberships.get(Number(id)) ?? [] }));
}

export async function changeDepartmentMaster(bytes: Uint8Array, change: DepartmentChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateDepartmentChange(listDepartments(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の部署は削除できません。");
    if (change.type === "delete" && database.exec("SELECT account_id FROM previous_amounts WHERE department_id = ? LIMIT 1", [change.id]).length) throw new Error("前年入力で使用中の部署は削除できません。");
    if (change.type !== "delete") {
      const ids = change.industryIds ?? listDepartments(database).find(item => item.id === (change.type === "update" ? change.id : -1))?.industryIds ?? [];
      if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || !database.exec("SELECT id FROM industries WHERE id = ?", [id]).length)) throw new Error("業種を一つ以上選択してください。重複や存在しない業種は指定できません。");
      if (change.type === "update") {
        const used = database.exec("SELECT industry_id FROM initiatives WHERE department_id = ? UNION SELECT industry_id FROM previous_amounts WHERE department_id = ?", [change.id, change.id])[0]?.values ?? [];
        if (used.some(([id]) => !ids.includes(Number(id)))) throw new Error("施策・前年入力で使用中の業種は部署から外せません。");
      }
    }
    if (change.type === "delete") { database.run("DELETE FROM departments WHERE id = ?", [change.id]); database.run("DELETE FROM triadic_metadata WHERE key = ?", [`departments_identity:${change.id}`]); }
    else if (change.type === "add") { database.run("INSERT INTO departments (name) VALUES (?)", [change.departmentName.trim()]); identifyNewClassification(database, "departments"); }
    else database.run("UPDATE departments SET name = ? WHERE id = ?", [change.departmentName.trim(), change.id]);
    if (change.type !== "delete" && change.industryIds !== undefined) {
      const id = change.type === "update" ? change.id : Number(database.exec("SELECT id FROM departments WHERE name = ?", [change.departmentName.trim()])[0]!.values[0]![0]);
      const before = listDepartments(database).find(item => item.id === id)!.industryIds;
      for (const industry of before.filter(value => !change.industryIds!.includes(value))) database.run("DELETE FROM department_industries WHERE department_id = ? AND industry_id = ?", [id, industry]);
      for (const industry of change.industryIds.filter(value => !before.includes(value))) database.run("INSERT INTO department_industries VALUES (?, ?)", [id, industry]);
    }
  })).bytes;
}
