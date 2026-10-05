import { ensureFiscalPeriods, validateNormalizedData } from "./migration10";
import { listDetailRecords, type DetailRecord } from "./details";
import { listPeriodTypes, type PeriodType } from "./periodMaster";
import { listDepartments, type Department } from "./departmentMaster";
import { amountToYen, yenToAmount, isValidAmount } from "./amounts";
import { listIndustries, type Industry } from "./industryMaster";
import { listExpansions, type Expansion } from "./expansionMaster";
import { type Database } from "sql.js";
import { listAccounts, type Account } from "./accountMaster";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { hasColumn, migrateTriadicDatabase } from "./triadicMigration";
import { listAggregations, type Aggregation } from "./aggregations";

export const initiativeMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
export type InitiativeMonth = typeof initiativeMonths[number];
export type InitiativeRow = { id?: number; accountId: number | null; amounts: Partial<Record<InitiativeMonth, string>> };
export type InitiativeEntryDraft = { name: string; note: string; expansionId: number | null; departmentId?: number | null; periodTypeId?: number | null; fiscalYear: string; rows: InitiativeRow[]; invalidNumbers?: boolean };
export type Initiative = {
  id: number;
  name: string;
  note: string;
  expansionId: number | null; departmentId?: number | null; periodTypeId?: number | null;
  fiscalYear: number | null;
  rows: InitiativeRow[];
  months: Partial<Record<InitiativeMonth, { sales: number | null; profit: number | null }>>;
};
export type PlanContents = { accounts: Account[]; initiatives: Initiative[]; aggregations: Aggregation[]; expansions: Expansion[]; industries: Industry[]; departments: Department[]; periodTypes: PeriodType[]; details?: DetailRecord[] | undefined; formatVersion?: number | undefined; migrationError?: string | undefined };

export function currentFiscalYear(): number {
  const now = new Date();
  return now.getFullYear() - (now.getMonth() < 3 ? 1 : 0);
}

export function createInitiativeDraft(fiscalYear = String(currentFiscalYear())): InitiativeEntryDraft {
  return { name: "", note: "", expansionId: null, departmentId: null, periodTypeId: null, fiscalYear, rows: [{ accountId: null, amounts: {} }] };
}

function listInitiatives(database: Database): Initiative[] {
  const normalized = Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) >= 10;
  const modern = hasColumn(database, "initiatives", "fiscal_year");
  const records: Initiative[] = [];
  const headers = database.exec(`SELECT id, name, ${modern ? "note, fiscal_year" : "'', NULL"}, ${hasColumn(database, "initiatives", "expansion_id") ? "expansion_id" : "NULL"}, ${hasColumn(database, "initiatives", "department_id") ? "department_id" : "NULL"}, ${hasColumn(database, "initiatives", "period_type_id") ? "period_type_id" : "NULL"}
    FROM initiatives WHERE budget_id = 1 ORDER BY sort_order, id`)[0]?.values ?? [];
  for (const [id, name, note, declaredYear, expansionId, departmentId, periodTypeId] of headers) {
    const details = normalized ? (database.exec(`SELECT r.account_id, i.fiscal_year + (m.month < 4), m.month, m.amount_yen, r.id
      FROM initiative_amounts m JOIN initiative_rows r ON r.id = m.row_id JOIN initiatives i ON i.id = r.initiative_id WHERE i.id = ? ORDER BY m.id`, [Number(id)])[0]?.values ?? []).map(row => [row[0], row[1], row[2], yenToAmount(Number(row[3])), row[4]]) : database.exec(`SELECT d.account_id, p.year, p.month, d.budget_amount, ${modern ? "d.entry_row_id" : "NULL"}
      FROM details d JOIN periods p ON p.id = d.period_id WHERE d.initiative_id = ? ORDER BY d.id`, [Number(id)])[0]?.values ?? [];
    const years = new Set<number>();
    if (declaredYear !== null) years.add(Number(declaredYear));
    for (const [, year, month] of details) years.add(Number(year) - (Number(month) < 4 ? 1 : 0));
    for (const fiscalYear of years.size ? years : [null]) {
      const rows = new Map<string, InitiativeRow>();
      if (modern && fiscalYear === declaredYear) {
        const storedRows = database.exec("SELECT id, account_id FROM initiative_rows WHERE initiative_id = ? ORDER BY sort_order, id", [Number(id)])[0]?.values ?? [];
        for (const [rowId, accountId] of storedRows) rows.set(`row:${rowId}`, { id: Number(rowId), accountId: Number(accountId), amounts: {} });
      }
      for (const [accountId, year, month, amount, rowId] of details) {
        if (Number(year) - (Number(month) < 4 ? 1 : 0) !== fiscalYear) continue;
        const key = rowId === null ? `account:${accountId}` : `row:${rowId}`;
        const row = rows.get(key) ?? { ...(rowId === null ? {} : { id: Number(rowId) }), accountId: Number(accountId), amounts: {} };
        const keyMonth = Number(month) as InitiativeMonth;
        row.amounts[keyMonth] = normalized ? String(amount) : String(Number(row.amounts[keyMonth] ?? 0) + Number(amount));
        rows.set(key, row);
      }
      const months: Initiative["months"] = {};
      if (fiscalYear !== null) {
        const totals = normalized ? (database.exec(`SELECT month,
          CASE WHEN COUNT(*) = COUNT(sales_effect_yen) THEN SUM(sales_effect_yen) END,
          CASE WHEN COUNT(*) = COUNT(profit_effect_yen) THEN SUM(profit_effect_yen) END
          FROM initiative_detail_view WHERE initiative_id = ? GROUP BY month`, [Number(id)])[0]?.values ?? []).map(row => [row[0], row[1] === null ? null : Number(yenToAmount(Number(row[1]))), row[2] === null ? null : Number(yenToAmount(Number(row[2])))])
          : database.exec(`SELECT month, budget_sales_amount, budget_profit_amount FROM expansion_view
          WHERE initiative_id = ? AND ((year = ? AND month >= 4) OR (year = ? AND month < 4))`, [Number(id), fiscalYear, fiscalYear + 1])[0]?.values ?? [];
        for (const [month, sales, profit] of totals) months[Number(month) as InitiativeMonth] = {
          sales: !modern || sales === null ? null : Number(sales),
          profit: !modern || profit === null ? null : Number(profit),
        };
      }
      records.push({ periodTypeId: periodTypeId === null ? null : Number(periodTypeId), departmentId: departmentId === null ? null : Number(departmentId), id: Number(id), name: String(name), note: String(note), expansionId: expansionId === null ? null : Number(expansionId), fiscalYear, rows: [...rows.values()], months });
    }
  }
  return records;
}

export async function readPlanContents(bytes: Uint8Array): Promise<PlanContents> {
  const database = await openTriadicDatabase(bytes);
  try {
    const formatVersion = Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]);
    let migrationError: string | undefined;
    if (formatVersion < 10) {
      try { migrateTriadicDatabase(database); } catch (error) { migrationError = error instanceof Error ? error.message : "保存形式を移行できません。"; }
    }
    return { accounts: listAccounts(database), initiatives: listInitiatives(database), aggregations: listAggregations(database), expansions: listExpansions(database), industries: listIndustries(database), departments: listDepartments(database), periodTypes: listPeriodTypes(database), formatVersion, migrationError, details: listDetailRecords(database) }; }
  finally { database.close(); }
}

export function validateInitiative(draft: InitiativeEntryDraft, accounts: Account[], initiatives: Initiative[], expansions: Expansion[], departments: Department[] = [], periodTypes: PeriodType[] = []): void {
  if (draft.invalidNumbers) throw new Error("年度・金額に有効な数値を入力してください。");
  if (!draft.name.trim()) throw new Error("施策名を入力してください。");
  if (!expansions.some(item => item.id === draft.expansionId)) throw new Error("展開名を選択してください。");
  if (draft.departmentId != null && !departments.some(item => item.id === draft.departmentId)) throw new Error("部署名を選択してください。");
  if (draft.periodTypeId != null && !periodTypes.some(item => item.id === draft.periodTypeId)) throw new Error("期間名を選択してください。");
  const year = Number(draft.fiscalYear);
  if (!/^\d{1,4}$/.test(draft.fiscalYear) || !Number.isInteger(year) || year < 1 || year > 9998) throw new Error("年度は1〜9998の整数で入力してください。");
  if (initiatives.some(item => item.name === draft.name.trim())) throw new Error("同じ施策名が登録されています。別の名前を入力してください。");
  if (!draft.rows.some(row => row.accountId !== null)) throw new Error("勘定科目を一つ以上選択してください。");
  draft.rows.forEach((row, index) => {
    const hasAmount = Object.values(row.amounts).some(value => value !== "");
    if (row.accountId === null && !hasAmount) return;
    const account = accounts.find(item => item.id === row.accountId);
    if (!account) throw new Error(`${index + 1}行目の勘定科目を選択してください。`);
    if (!account.accountType) throw new Error(`「${account.accountName}」の科目属性をマスタで設定してください。`);
    for (const [month, amount] of Object.entries(row.amounts)) {
      if (!initiativeMonths.includes(Number(month) as InitiativeMonth)) throw new Error("対象月が正しくありません。");
      if (amount !== "" && !isValidAmount(amount)) throw new Error(`${index + 1}行目の${month}月に有効な金額を千円単位・小数点以下3桁までで入力してください。`);
    }
  });
}

/** Register 12 fixed months per input row on a private database copy. */
export async function registerInitiative(bytes: Uint8Array, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateInitiative(draft, listAccounts(database), listInitiatives(database), listExpansions(database), listDepartments(database), listPeriodTypes(database));
    database.run("BEGIN");
    database.run(`INSERT INTO initiatives (name, note, fiscal_year, expansion_id, department_id, period_type_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM initiatives))`, [draft.name.trim(), draft.note, Number(draft.fiscalYear), draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null]);
    const id = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
    ensureFiscalPeriods(database, Number(draft.fiscalYear));
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      database.run("INSERT INTO initiative_rows (initiative_id, account_id, sort_order) VALUES (?, ?, ?)", [id, row.accountId, index]);
      const rowId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
      for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month, amount_yen) VALUES (?, ?, ?)", [rowId, month, amountToYen(row.amounts[month] || "0")]);
    }
    validateNormalizedData(database);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}

/** Updating a shared owner keeps its IDs and every month's legacy payload. */
export async function updateInitiative(bytes: Uint8Array, id: number, previousYear: number | null, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    const initiatives = listInitiatives(database);
    const original = initiatives.find(item => item.id === id && item.fiscalYear === previousYear);
    if (!original) throw new Error("更新する施策が見つかりません。");
    validateInitiative(draft, listAccounts(database), initiatives.filter(item => item.id !== id), listExpansions(database), listDepartments(database), listPeriodTypes(database));
    if (draft.rows.length < original.rows.length || original.rows.some((row, index) => draft.rows[index]?.accountId === null || (draft.rows[index]?.id !== undefined && draft.rows[index]?.id !== row.id))) throw new Error("登録済みの行は削除・移動できません。");
    database.run("BEGIN");
    database.run("UPDATE initiatives SET name = ?, note = ?, fiscal_year = ?, expansion_id = ?, department_id = ?, period_type_id = ?, revision = revision + 1 WHERE id = ?", [draft.name.trim(), draft.note, Number(draft.fiscalYear), draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null, id]);
    ensureFiscalPeriods(database, Number(draft.fiscalYear));
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      let rowId = original.rows[index]?.id;
      if (rowId === undefined) {
        database.run("INSERT INTO initiative_rows (initiative_id, account_id, sort_order) VALUES (?, ?, ?)", [id, row.accountId, index]);
        rowId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
        for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month) VALUES (?, ?)", [rowId, month]);
      } else database.run("UPDATE initiative_rows SET account_id = ?, revision = revision + 1 WHERE id = ? AND initiative_id = ?", [row.accountId, rowId, id]);
      for (const month of initiativeMonths) database.run("UPDATE initiative_amounts SET amount_yen = ?, revision = revision + 1 WHERE row_id = ? AND month = ?", [amountToYen(row.amounts[month] || "0"), rowId, month]);
    }
    validateNormalizedData(database);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
