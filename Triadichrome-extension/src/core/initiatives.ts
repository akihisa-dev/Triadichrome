import { type Database } from "sql.js";
import { listAccounts, type Account } from "./accountMaster";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { hasColumn, migrateTriadicDatabase } from "./triadicMigration";

export const initiativeMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
export type InitiativeMonth = typeof initiativeMonths[number];
export type InitiativeRow = { accountId: number | null; amounts: Partial<Record<InitiativeMonth, string>> };
export type InitiativeEntryDraft = { name: string; note: string; fiscalYear: string; rows: InitiativeRow[] };
export type Initiative = {
  id: number;
  name: string;
  note: string;
  fiscalYear: number | null;
  rows: InitiativeRow[];
  months: Partial<Record<InitiativeMonth, { sales: number | null; profit: number | null }>>;
};
export type PlanContents = { accounts: Account[]; initiatives: Initiative[] };

export function currentFiscalYear(): number {
  const now = new Date();
  return now.getFullYear() - (now.getMonth() < 3 ? 1 : 0);
}

export function createInitiativeDraft(fiscalYear = String(currentFiscalYear())): InitiativeEntryDraft {
  return { name: "", note: "", fiscalYear, rows: [{ accountId: null, amounts: {} }] };
}

function listInitiatives(database: Database): Initiative[] {
  const modern = hasColumn(database, "initiatives", "fiscal_year");
  const records: Initiative[] = [];
  const headers = database.exec(`SELECT id, name, ${modern ? "note, fiscal_year" : "'', NULL"}
    FROM initiatives WHERE budget_id = 1 ORDER BY sort_order, id`)[0]?.values ?? [];
  for (const [id, name, note, declaredYear] of headers) {
    const details = database.exec(`SELECT d.account_id, p.year, p.month, d.budget_amount, ${modern ? "d.entry_row_id" : "NULL"}
      FROM details d JOIN periods p ON p.id = d.period_id WHERE d.initiative_id = ? ORDER BY d.id`, [Number(id)])[0]?.values ?? [];
    const years = new Set<number>();
    if (declaredYear !== null) years.add(Number(declaredYear));
    for (const [, year, month] of details) years.add(Number(year) - (Number(month) < 4 ? 1 : 0));
    for (const fiscalYear of years.size ? years : [null]) {
      const rows = new Map<string, InitiativeRow>();
      if (modern && fiscalYear === declaredYear) {
        const storedRows = database.exec("SELECT id, account_id FROM initiative_rows WHERE initiative_id = ? ORDER BY sort_order, id", [Number(id)])[0]?.values ?? [];
        for (const [rowId, accountId] of storedRows) rows.set(`row:${rowId}`, { accountId: Number(accountId), amounts: {} });
      }
      for (const [accountId, year, month, amount, rowId] of details) {
        if (Number(year) - (Number(month) < 4 ? 1 : 0) !== fiscalYear) continue;
        const key = rowId === null ? `account:${accountId}` : `row:${rowId}`;
        const row = rows.get(key) ?? { accountId: Number(accountId), amounts: {} };
        row.amounts[Number(month) as InitiativeMonth] = String(amount);
        rows.set(key, row);
      }
      const months: Initiative["months"] = {};
      if (fiscalYear !== null) {
        const totals = database.exec(`SELECT month, budget_sales_amount, budget_profit_amount FROM expansion_view
          WHERE initiative_id = ? AND ((year = ? AND month >= 4) OR (year = ? AND month < 4))`, [Number(id), fiscalYear, fiscalYear + 1])[0]?.values ?? [];
        for (const [month, sales, profit] of totals) months[Number(month) as InitiativeMonth] = {
          sales: !modern || sales === null ? null : Number(sales),
          profit: !modern || profit === null ? null : Number(profit),
        };
      }
      records.push({ id: Number(id), name: String(name), note: String(note), fiscalYear, rows: [...rows.values()], months });
    }
  }
  return records;
}

export async function readPlanContents(bytes: Uint8Array): Promise<PlanContents> {
  const database = await openTriadicDatabase(bytes);
  try { return { accounts: listAccounts(database), initiatives: listInitiatives(database) }; }
  finally { database.close(); }
}

export function validateInitiative(draft: InitiativeEntryDraft, accounts: Account[], initiatives: Initiative[]): void {
  if (!draft.name.trim()) throw new Error("施策名を入力してください。");
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
      if (amount !== "" && (!amount.trim() || !Number.isFinite(Number(amount)))) throw new Error(`${index + 1}行目の${month}月に有効な金額を入力してください。`);
    }
  });
}

/** Register on a copy. Empty months have no detail, preserving blank versus zero. */
export async function registerInitiative(bytes: Uint8Array, draft: InitiativeEntryDraft): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(database);
    validateInitiative(draft, listAccounts(database), listInitiatives(database));
    database.run("BEGIN");
    database.run(`INSERT INTO initiatives (budget_id, name, note, fiscal_year, sort_order)
      VALUES (1, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM initiatives))`, [draft.name.trim(), draft.note, Number(draft.fiscalYear)]);
    const initiativeId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
    const periods = new Map<InitiativeMonth, number>();
    for (const month of initiativeMonths) {
      const year = Number(draft.fiscalYear) + (month < 4 ? 1 : 0);
      database.run("INSERT OR IGNORE INTO periods (budget_id, year, month) VALUES (1, ?, ?)", [year, month]);
      periods.set(month, Number(database.exec("SELECT id FROM periods WHERE budget_id = 1 AND year = ? AND month = ?", [year, month])[0]!.values[0]![0]));
    }
    for (const [index, row] of draft.rows.entries()) {
      if (row.accountId === null) continue;
      database.run("INSERT INTO initiative_rows (initiative_id, account_id, sort_order) VALUES (?, ?, ?)", [initiativeId, row.accountId, index]);
      const rowId = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
      for (const month of initiativeMonths) {
        const amount = row.amounts[month];
        if (amount === undefined || amount === "") continue;
        database.run(`INSERT INTO details (budget_id, period_id, initiative_id, account_id, entry_row_id, budget_amount)
          VALUES (1, ?, ?, ?, ?, ?)`, [periods.get(month)!, initiativeId, row.accountId, rowId, Number(amount)]);
      }
    }
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.run("COMMIT");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
