import { type Database } from "sql.js";
import { amountToYen, yenToAmount } from "./amounts";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";
import { ensureFiscalPeriods, validateNormalizedData } from "./migration10";

export type DetailRecord = {
  id: number; rowId: number; initiativeId: number; initiativeName: string; note: string;
  fiscalYear: number; year: number; month: number; expansionId: number | null;
  departmentId: number | null; periodTypeId: number | null; accountId: number;
  accountCode: string | null; accountName: string; accountType: string | null;
  amount: string; sales: string | null; profit: string | null;
  initiativeOrder: number; rowOrder: number; initiativeRevision: number; rowRevision: number; revision: number;
};
export function listDetailRecords(db: Database): DetailRecord[] {
  if (Number(db.exec("PRAGMA user_version")[0]!.values[0]![0]) < 10) return [];
  return (db.exec("SELECT * FROM initiative_detail_view ORDER BY fiscal_year, initiative_order, initiative_id, row_order, row_id, fiscal_month_position")[0]?.values ?? []).map(v => ({
    id: Number(v[0]), rowId: Number(v[1]), initiativeId: Number(v[2]), initiativeName: String(v[3]), note: String(v[4]),
    fiscalYear: Number(v[5]), year: Number(v[6]), month: Number(v[7]), expansionId: v[9] === null ? null : Number(v[9]),
    departmentId: v[10] === null ? null : Number(v[10]), periodTypeId: v[11] === null ? null : Number(v[11]),
    accountId: Number(v[12]), accountCode: v[13] === null ? null : String(v[13]), accountName: String(v[14]), accountType: v[15] === null ? null : String(v[15]),
    amount: yenToAmount(Number(v[16])), sales: v[17] === null ? null : yenToAmount(Number(v[17])), profit: v[18] === null ? null : yenToAmount(Number(v[18])),
    initiativeOrder: Number(v[19]), rowOrder: Number(v[20]), initiativeRevision: Number(v[21]), rowRevision: Number(v[22]), revision: Number(v[23]),
  }));
}
export type DetailField = "name" | "note" | "fiscalYear" | "expansionId" | "departmentId" | "periodTypeId" | "accountId" | "amount";
export type DetailChange = { target: Pick<DetailRecord, "id" | "rowId" | "initiativeId" | "initiativeRevision" | "rowRevision" | "revision">; field: DetailField; value: string };

export async function changeDetail(bytes: Uint8Array, change: DetailChange): Promise<Uint8Array> {
  const db = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(db);
    const current = listDetailRecords(db).find(d => d.id === change.target.id);
    if (!current || current.rowId !== change.target.rowId || current.initiativeId !== change.target.initiativeId) throw new Error("編集対象の明細が一致しません。");
    if (current.initiativeRevision !== change.target.initiativeRevision || current.rowRevision !== change.target.rowRevision || current.revision !== change.target.revision) throw new Error("編集開始後にデータが変更されています。最新の値を確認して編集し直してください。");
    db.run("BEGIN");
    const { field, value } = change;
    if (field === "amount") {
      if (!current.accountType) throw new Error("科目属性をマスタで設定してください。");
      db.run("UPDATE initiative_amounts SET amount_yen = ?, revision = revision + 1 WHERE id = ?", [amountToYen(value || "0"), current.id]);
    } else if (field === "accountId") {
      const selected = db.exec("SELECT attribute FROM accounts WHERE id = ?", [Number(value)])[0]?.values[0];
      if (!selected?.[0]) throw new Error("属性が設定済みの登録科目を選択してください。");
      db.run("UPDATE initiative_rows SET account_id = ?, revision = revision + 1 WHERE id = ?", [Number(value), current.rowId]);
    } else {
      const columns = { name: "name", note: "note", fiscalYear: "fiscal_year", expansionId: "expansion_id", departmentId: "department_id", periodTypeId: "period_type_id" };
      let savedValue: string | number | null = value;
      if (field === "name") {
        savedValue = value.trim();
        if (!savedValue) throw new Error("施策名を入力してください。");
        if (db.exec("SELECT id FROM initiatives WHERE name = ? AND id != ?", [savedValue, current.initiativeId]).length) throw new Error("同じ施策名が登録されています。");
      } else if (field === "fiscalYear") {
        if (!/^\d{1,4}$/.test(value) || Number(value) < 1 || Number(value) > 9998) throw new Error("年度は1〜9998の整数で入力してください。");
        savedValue = Number(value);
        ensureFiscalPeriods(db, savedValue);
      } else if (field !== "note") {
        const tables = { expansionId: "expansions", departmentId: "departments", periodTypeId: "period_types" };
        savedValue = value === "" ? null : Number(value);
        if (field === "expansionId" && savedValue === null) throw new Error("展開名を選択してください。");
        if (savedValue !== null && !db.exec(`SELECT id FROM ${tables[field]} WHERE id = ?`, [savedValue]).length) throw new Error("登録済みの項目を選択してください。");
      }
      db.run(`UPDATE initiatives SET ${columns[field]} = ?, revision = revision + 1 WHERE id = ?`, [savedValue, current.initiativeId]);
    }
    validateNormalizedData(db);
    db.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    db.run("COMMIT");
    return exportTriadicDatabase(db);
  } finally { db.close(); }
}
