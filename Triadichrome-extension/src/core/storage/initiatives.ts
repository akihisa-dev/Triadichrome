import type { Database } from "./sqliteRuntime";
import { amountToYen } from "../domain/amounts";
import { canChangeAccountRow, kindIds, type KindOverrides } from "../domain/kinds";
import { initiativeMonths } from "../domain/calendar";
import type { InitiativeEntryDraft } from "../domain/plan";
import { validateInitiative } from "../domain/initiativeRules";
import { listAccounts } from "./accountMaster";
import { listExpansions } from "./expansionMaster";
import { listDepartments } from "./departmentMaster";
import { listPeriodTypes } from "./periodMaster";
import { listIndustries } from "./industryMaster";
import { listInitiatives } from "./readPlan";
import { readPlanSettings, readRowOverrides } from "./settings";
import { editDatabase } from "./transaction";
const listNames = (database: Database, except?: number) => (database.exec("SELECT id, name FROM initiatives")[0]?.values ?? [])
  .filter(([id]) => id !== except).map(([, name]) => ({ name: String(name) }));
/** Register 12 fixed months per input row on a private database copy. */
export async function registerInitiative(bytes: Uint8Array, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    validateInitiative(draft, listAccounts(database), listNames(database), listExpansions(database), listDepartments(database), listPeriodTypes(database), listIndustries(database));
    if (Number(draft.fiscalYear) !== readPlanSettings(database).fiscalYear) throw new Error("年度はファイルの基準年度と同じにしてください。");
    database.run(`INSERT INTO initiatives (name, note, expansion_id, department_id, period_type_id, industry_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM initiatives))`, [draft.name.trim(), draft.note, draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null, draft.industryId ?? null]);
    const id = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      const rowId = row.id ?? crypto.randomUUID();
      database.run("INSERT INTO initiative_rows (id, initiative_id, account_id, sort_order) VALUES (?, ?, ?, ?)", [rowId, id, row.accountId, index]);
      for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month, amount_yen) VALUES (?, ?, ?)", [rowId, month, amountToYen(row.amounts[month] || "0")]);
      writeOverrides(database, rowId, row.overrides);
    }
  })).bytes;
}

function writeOverrides(db: Database, rowId: string, overrides: KindOverrides | undefined): void {
  const previous = readRowOverrides(db, rowId);
  for (const kind of kindIds.filter(id => id !== 1)) {
    for (const month of initiativeMonths) {
      const value = overrides?.[kind]?.[month];
      const old = previous[kind]?.[month];
      if (value === undefined) {
        if (old !== undefined) db.run("DELETE FROM amount_overrides WHERE row_id = ? AND month = ?", [rowId, month]);
      } else if (old === undefined || amountToYen(value || "0") !== amountToYen(old || "0")) {
        db.run(`INSERT INTO amount_overrides (row_id, month, amount_yen) VALUES (?, ?, ?)
          ON CONFLICT (row_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = amount_overrides.revision + 1`, [rowId, month, amountToYen(value || "0")]);
      }
    }
  }
}

export async function updateInitiative(bytes: Uint8Array, id: number, previousYear: number | null, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  return (await editDatabase(bytes, database => {
    const settings = readPlanSettings(database);
    const initiatives = listInitiatives(database, readPlanSettings(database).fiscalYear, id);
    const original = initiatives.find(item => item.id === id && item.fiscalYear === previousYear);
    if (!original) throw new Error("更新する施策が見つかりません。");
    if (Number(draft.fiscalYear) !== settings.fiscalYear) throw new Error("年度はファイルの基準年度と同じにしてください。");
    validateInitiative(draft, listAccounts(database), listNames(database, id), listExpansions(database), listDepartments(database), listPeriodTypes(database), listIndustries(database), true);
    const ids = draft.rows.flatMap(row => row.id === undefined ? [] : [row.id]);
    if (new Set(ids).size !== ids.length || ids.some(rowId => { const owner = database.exec("SELECT initiative_id FROM initiative_rows WHERE id = ?", [rowId])[0]?.values[0]?.[0]; return owner !== undefined && owner !== id; })) throw new Error("勘定科目行の識別子が正しくありません。");
    for (const row of original.rows) {
      const next = draft.rows.find(item => item.id === row.id);
      if ((!next || next.accountId !== row.accountId) && !canChangeAccountRow(row)) throw new Error("全種別・全月の金額が0の行だけ勘定科目を変更・削除できます。");
    }
    database.run("UPDATE initiatives SET name = ?, note = ?, expansion_id = ?, department_id = ?, period_type_id = ?, industry_id = ?, revision = revision + 1 WHERE id = ?", [draft.name.trim(), draft.note, draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null, draft.industryId ?? null, id]);
    for (const row of original.rows) if (!draft.rows.some(item => item.id === row.id && item.accountId !== null)) {
      database.run("DELETE FROM initiative_amounts WHERE row_id = ?", [row.id!]);
      database.run("DELETE FROM initiative_rows WHERE id = ?", [row.id!]);
    }
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      let rowId = row.id;
      if (rowId === undefined || !original.rows.some(saved => saved.id === rowId)) {
        rowId ??= crypto.randomUUID();
        database.run("INSERT INTO initiative_rows (id, initiative_id, account_id, sort_order) VALUES (?, ?, ?, ?)", [rowId, id, row.accountId, index]);
        for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month) VALUES (?, ?)", [rowId, month]);
      } else database.run("UPDATE initiative_rows SET account_id = ?, sort_order = ?, revision = revision + 1 WHERE id = ? AND initiative_id = ?", [row.accountId, index, rowId, id]);
      for (const month of initiativeMonths) database.run("UPDATE initiative_amounts SET amount_yen = ?, revision = revision + 1 WHERE row_id = ? AND month = ? AND amount_yen != ?", [amountToYen(row.amounts[month] || "0"), rowId, month, amountToYen(row.amounts[month] || "0")]);
      writeOverrides(database, rowId, row.overrides);
    }
  })).bytes;
}
