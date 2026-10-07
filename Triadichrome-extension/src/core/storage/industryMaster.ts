import type { Database } from "sql.js";
import { editDatabase } from "./transaction";
import { validateIndustryChange, type Industry, type IndustryChange } from "../domain/industryMaster";
export function listIndustries(database: Database): Industry[] {
  return (database.exec("SELECT id, code, name FROM industries ORDER BY length(code), code, id")[0]?.values ?? [])
    .map(([id, code, name]) => ({ id: Number(id), industryCode: String(code), industryName: String(name) }));
}

export async function changeIndustryMaster(bytes: Uint8Array, change: IndustryChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateIndustryChange(listIndustries(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE industry_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用している業種は削除できません。");
    if (change.type === "delete" && database.exec("SELECT account_id FROM previous_amounts WHERE industry_id = ? LIMIT 1", [change.id]).length) throw new Error("前年入力で使用中の業種は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM industries WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO industries (code, name) VALUES (?, ?)", [change.industryCode.trim(), change.industryName.trim()]);
    else database.run("UPDATE industries SET code = ?, name = ? WHERE id = ?", [change.industryCode.trim(), change.industryName.trim(), change.id]);
  })).bytes;
}
