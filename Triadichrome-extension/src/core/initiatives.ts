import { canChangeAccountRow, kindIds, readPlanSettings, readRowOverrides, resolvedAmount, type KindId, type KindOverrides, type PlanSettings } from "./kindAmounts";
import { listKinds, type Kind } from "./kindMaster";
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
import { migrateTriadicDatabase } from "./triadicMigration";
import { listAggregations, type Aggregation } from "./aggregations";

export const initiativeMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
export type InitiativeMonth = typeof initiativeMonths[number];
export type InitiativeRow = { id?: number; clientKey?: string; accountId: number | null; amounts: Partial<Record<InitiativeMonth, string>>; overrides?: KindOverrides };
export type InitiativeEntryDraft = { name: string; note: string; expansionId: number | null; departmentId?: number | null; periodTypeId?: number | null; industryId?: number | null; fiscalYear: string; rows: InitiativeRow[]; invalidNumbers?: boolean };
export type Initiative = {
  id: number;
  name: string;
  note: string;
  expansionId: number | null; departmentId?: number | null; periodTypeId?: number | null; industryId?: number | null;
  fiscalYear: number | null;
  rows: InitiativeRow[];
  months: Partial<Record<InitiativeMonth, { sales: number | null; expense: number; profit: number | null }>>;
};
export type PlanContents = PlanSettings & { accounts: Account[]; initiatives: Initiative[]; aggregations: Aggregation[]; expansions: Expansion[]; industries: Industry[]; departments: Department[]; periodTypes: PeriodType[]; kinds: Kind[]; details?: DetailRecord[] | undefined; formatVersion?: number | undefined; migrationError?: string | undefined };

export function currentFiscalYear(): number {
  const now = new Date();
  return now.getFullYear() - (now.getMonth() < 3 ? 1 : 0);
}

export function createInitiativeDraft(fiscalYear = String(currentFiscalYear())): InitiativeEntryDraft {
  return { name: "", note: "", expansionId: null, departmentId: null, periodTypeId: null, industryId: null, fiscalYear, rows: [{ clientKey: crypto.randomUUID(), accountId: null, amounts: {} }] };
}

function listInitiatives(database: Database): Initiative[] {
  const settings = readPlanSettings(database);
  const headers = database.exec("SELECT id, name, note, expansion_id, department_id, period_type_id, industry_id FROM initiatives ORDER BY sort_order, id")[0]?.values ?? [];
  const records: Initiative[] = headers.map(([id, name, note, expansion, department, period, industry]) => {
    const rows: InitiativeRow[] = (database.exec("SELECT id, account_id, client_key FROM initiative_rows WHERE initiative_id = ? ORDER BY sort_order, id", [Number(id)])[0]?.values ?? []).map(([rowId, accountId, clientKey]) => ({
      id: Number(rowId), accountId: Number(accountId), ...(clientKey === null ? {} : { clientKey: String(clientKey) }),
      amounts: Object.fromEntries((database.exec("SELECT month, amount_yen FROM initiative_amounts WHERE row_id = ?", [Number(rowId)])[0]?.values ?? []).map(([month, amount]) => [Number(month), yenToAmount(Number(amount))])), overrides: readRowOverrides(database, Number(rowId)),
    }));
    return { id: Number(id), name: String(name), note: String(note), fiscalYear: settings.fiscalYear, expansionId: Number(expansion), departmentId: Number(department), periodTypeId: period === null ? null : Number(period), industryId: Number(industry), rows, months: {} };
  });
  return initiativesForKind(records, listAccounts(database), 1, settings.revisedActive);
}

export async function readPlanContents(bytes: Uint8Array): Promise<PlanContents> {
  const database = await openTriadicDatabase(bytes);
  try {
    const formatVersion = Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]);
    let migrationError: string | undefined;
    if (formatVersion < 12) {
      try { migrateTriadicDatabase(database); } catch (error) { migrationError = error instanceof Error ? error.message : "保存形式を移行できません。"; }
    }
    return { ...readPlanSettings(database), accounts: listAccounts(database), initiatives: listInitiatives(database), aggregations: listAggregations(database), expansions: listExpansions(database), industries: listIndustries(database), departments: listDepartments(database), periodTypes: listPeriodTypes(database), kinds: listKinds(database), formatVersion, migrationError, details: listDetailRecords(database) }; }
  finally { database.close(); }
}

export function validateInitiative(draft: InitiativeEntryDraft, accounts: Account[], initiatives: Initiative[], expansions: Expansion[], departments: Department[] = [], periodTypes: PeriodType[] = [], industries: Industry[] = [], allowEmptyRows = false): void {
  if (draft.invalidNumbers) throw new Error("年度・金額に有効な数値を入力してください。");
  if (!draft.name.trim()) throw new Error("施策名を入力してください。");
  if (!expansions.some(item => item.id === draft.expansionId)) throw new Error("展開名を選択してください。");
  if (!departments.some(item => item.id === draft.departmentId)) throw new Error("部署名を選択してください。");
  if (draft.periodTypeId != null && !periodTypes.some(item => item.id === draft.periodTypeId)) throw new Error("期間名を選択してください。");
  if (!industries.some(item => item.id === draft.industryId)) throw new Error("業種名を選択してください。");
  const year = Number(draft.fiscalYear);
  if (!/^\d{1,4}$/.test(draft.fiscalYear) || !Number.isInteger(year) || year < 1 || year > 9998) throw new Error("年度は1〜9998の整数で入力してください。");
  if (initiatives.some(item => item.name === draft.name.trim())) throw new Error("同じ施策名が登録されています。別の名前を入力してください。");
  if (!allowEmptyRows && !draft.rows.some(row => row.accountId !== null)) throw new Error("勘定科目を一つ以上選択してください。");
  draft.rows.forEach((row, index) => {
    const hasAmount = Object.values(row.amounts).some(value => value !== "");
    if (row.accountId === null && !hasAmount) return;
    const account = accounts.find(item => item.id === row.accountId);
    if (!account) throw new Error(`${index + 1}行目の勘定科目を選択してください。`);
    if (!account.accountType) throw new Error(`「${account.accountName}」の科目属性をマスタで設定してください。`);
    const values = [row.amounts, ...Object.values(row.overrides ?? {})];
    for (const [month, amount] of values.flatMap(values => Object.entries(values))) {
      if (!initiativeMonths.includes(Number(month) as InitiativeMonth)) throw new Error("対象月が正しくありません。");
      if (amount !== "" && !isValidAmount(amount)) throw new Error(`${index + 1}行目の${month}月に有効な金額を千円単位・小数点以下3桁までで入力してください。`);
    }
    for (const [kind, amounts] of Object.entries(row.overrides ?? {})) {
      if (![2, 3, 4, 5].includes(Number(kind))) throw new Error("種別が正しくありません。");
      if (Number(kind) === 3 && Object.keys(amounts).some(month => Number(month) >= 4 && Number(month) <= 9)) throw new Error("修正予算の4〜9月は実績から引き継ぐため編集できません。");
    }
  });
}

/** Register 12 fixed months per input row on a private database copy. */
export async function registerInitiative(bytes: Uint8Array, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateInitiative(draft, listAccounts(database), listInitiatives(database), listExpansions(database), listDepartments(database), listPeriodTypes(database), listIndustries(database));
    if (Number(draft.fiscalYear) !== readPlanSettings(database).fiscalYear) throw new Error("年度はファイルの基準年度と同じにしてください。");
    database.run("BEGIN");
    database.run(`INSERT INTO initiatives (name, note, fiscal_year, expansion_id, department_id, period_type_id, industry_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM initiatives))`, [draft.name.trim(), draft.note, Number(draft.fiscalYear), draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null, draft.industryId ?? null]);
    const id = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
    ensureFiscalPeriods(database, Number(draft.fiscalYear));
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      database.run("INSERT INTO initiative_rows (initiative_id, account_id, sort_order, client_key) VALUES (?, ?, ?, ?)", [id, row.accountId, index, row.clientKey ?? null]);
      const rowId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
      for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month, amount_yen) VALUES (?, ?, ?)", [rowId, month, amountToYen(row.amounts[month] || "0")]);
      writeOverrides(database, rowId, row.overrides);
    }
    validateNormalizedData(database);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}

function writeOverrides(db: Database, rowId: number, overrides: KindOverrides | undefined): void {
  const previous = readRowOverrides(db, rowId);
  for (const kind of kindIds.filter(id => id !== 1)) {
    for (const month of initiativeMonths) {
      const value = overrides?.[kind]?.[month];
      const old = previous[kind]?.[month];
      if (value === undefined) {
        if (old !== undefined) db.run("DELETE FROM amount_overrides WHERE row_id = ? AND kind_id = ? AND month = ?", [rowId, kind, month]);
      } else if (old === undefined || amountToYen(value || "0") !== amountToYen(old || "0")) {
        db.run(`INSERT INTO amount_overrides (row_id, kind_id, month, amount_yen) VALUES (?, ?, ?, ?)
          ON CONFLICT (row_id, kind_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = amount_overrides.revision + 1`, [rowId, kind, month, amountToYen(value || "0")]);
      }
    }
  }
}

/** Resolve a kind once and pass the same projected values to all tables. */
export function initiativesForKind(initiatives: Initiative[], accounts: Account[], kind: KindId, revisedActive: boolean): Initiative[] {
  return initiatives.map(initiative => {
    const rows = initiative.rows.map(row => ({ ...row, amounts: Object.fromEntries(initiativeMonths.map(month => [month, resolvedAmount(row, kind, month, revisedActive)])) }));
    const months: Initiative["months"] = {};
    for (const month of initiativeMonths) {
      let salesYen = 0n, expenseYen = 0n, profitYen = 0n;
      for (const row of rows) {
        const attribute = accounts.find(account => account.id === row.accountId)?.accountType;
        const amount = BigInt(amountToYen(row.amounts[month] || "0"));
        if (attribute === "sales") { salesYen += amount; profitYen += amount; }
        if (attribute === "cost") { salesYen -= amount; profitYen -= amount; }
        if (attribute === "expense") { expenseYen += amount; profitYen -= amount; }
        if (attribute === "profit") profitYen += amount;
      }
      months[month] = { sales: Number(yenToAmount(Number(salesYen))), expense: Number(yenToAmount(Number(expenseYen))), profit: Number(yenToAmount(Number(profitYen))) };
    }
    return { ...initiative, rows, months };
  });
}

export async function updateInitiative(bytes: Uint8Array, id: number, previousYear: number | null, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    const settings = readPlanSettings(database);
    const initiatives = listInitiatives(database);
    const original = initiatives.find(item => item.id === id && item.fiscalYear === previousYear);
    if (!original) throw new Error("更新する施策が見つかりません。");
    if (Number(draft.fiscalYear) !== settings.fiscalYear) throw new Error("年度はファイルの基準年度と同じにしてください。");
    draft = { ...draft, rows: draft.rows.map(row => {
      const saved = row.id === undefined && row.clientKey ? original.rows.find(item => item.clientKey === row.clientKey) : undefined;
      return saved ? { ...row, id: saved.id! } : row;
    }) };
    validateInitiative(draft, listAccounts(database), initiatives.filter(item => item.id !== id), listExpansions(database), listDepartments(database), listPeriodTypes(database), listIndustries(database), true);
    const ids = draft.rows.flatMap(row => row.id === undefined ? [] : [row.id]);
    if (new Set(ids).size !== ids.length || ids.some(rowId => !original.rows.some(row => row.id === rowId))) throw new Error("勘定科目行の識別子が正しくありません。");
    for (const row of original.rows) {
      const next = draft.rows.find(item => item.id === row.id);
      if ((!next || next.accountId !== row.accountId) && !canChangeAccountRow(row, settings.revisedActive)) throw new Error("全種別・全月の金額が0の行だけ勘定科目を変更・削除できます。");
    }
    database.run("BEGIN");
    database.run("UPDATE initiatives SET name = ?, note = ?, expansion_id = ?, department_id = ?, period_type_id = ?, industry_id = ?, revision = revision + 1 WHERE id = ?", [draft.name.trim(), draft.note, draft.expansionId, draft.departmentId ?? null, draft.periodTypeId ?? null, draft.industryId ?? null, id]);
    for (const row of original.rows) if (!draft.rows.some(item => item.id === row.id)) {
      database.run("DELETE FROM initiative_amounts WHERE row_id = ?", [row.id!]);
      database.run("DELETE FROM initiative_rows WHERE id = ?", [row.id!]);
    }
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      let rowId = row.id;
      if (rowId === undefined) {
        database.run("INSERT INTO initiative_rows (initiative_id, account_id, sort_order, client_key) VALUES (?, ?, ?, ?)", [id, row.accountId, index, row.clientKey ?? null]);
        rowId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
        for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id, month) VALUES (?, ?)", [rowId, month]);
      } else database.run("UPDATE initiative_rows SET account_id = ?, sort_order = ?, revision = revision + 1 WHERE id = ? AND initiative_id = ?", [row.accountId, index, rowId, id]);
      for (const month of initiativeMonths) database.run("UPDATE initiative_amounts SET amount_yen = ?, revision = revision + 1 WHERE row_id = ? AND month = ? AND amount_yen != ?", [amountToYen(row.amounts[month] || "0"), rowId, month, amountToYen(row.amounts[month] || "0")]);
      writeOverrides(database, rowId, row.overrides);
    }
    validateNormalizedData(database);
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
