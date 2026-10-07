import type { Database } from "sql.js";
import { startMonthRuleForName } from "../domain/initiativeStartMonth";
import { editDatabase } from "./transaction";
import { validatePeriodTypeChange, type PeriodType, type PeriodTypeChange } from "../domain/periodMaster";
export function listPeriodTypes(database: Database): PeriodType[] {
  return (database.exec("SELECT id, name FROM period_types ORDER BY id")[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), periodName: String(name) }));
}

export async function changePeriodMaster(bytes: Uint8Array, change: PeriodTypeChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validatePeriodTypeChange(listPeriodTypes(database), change);
    if (change.type === "delete" && database.exec("SELECT id FROM initiatives WHERE period_type_id = ? LIMIT 1", [change.id]).length) throw new Error("施策で使用中の期間は削除できません。");
    if (change.type === "delete") database.run("DELETE FROM period_types WHERE id = ?", [change.id]);
    else if (change.type === "add") database.run("INSERT INTO period_types (name, start_month_rule) VALUES (?, ?)", [change.periodName.trim(), startMonthRuleForName(change.periodName.trim())]);
    else database.run("UPDATE period_types SET name = ? WHERE id = ?", [change.periodName.trim(), change.id]);
  })).bytes;
}
