import type { Database } from "sql.js";
import { amountToYen, yenToAmount } from "./amounts";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";

export const kindIds = [1, 2] as const;
export type KindId = typeof kindIds[number];
export type MonthAmounts = Partial<Record<number, string>>;
export type KindOverrides = Partial<Record<KindId, MonthAmounts>>;
export type AmountSource = { amounts: MonthAmounts; overrides?: KindOverrides };
export type KindScreen = "initiative-list" | "cost-table" | "expansion-table";
export type KindSelections = Record<KindScreen, KindId[]>;
export type PreviousAmount = { accountId: number; industryId: number; departmentId: number; month: number; amount: string; revision: number };
export type PlanSettings = { fiscalYear: number; kindSelections: KindSelections; previousAmounts: PreviousAmount[] };

export function isKindId(value: number): value is KindId { return kindIds.some(id => id === value); }
export function resolvedAmount(source: AmountSource, kind: KindId, month: number): string {
  if (!isKindId(kind)) throw new Error("種別が正しくありません。");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("対象月が正しくありません。");
  if (kind === 1) return source.amounts[month] || "0";
  const manual = source.overrides?.[2]?.[month];
  return manual === undefined ? source.amounts[month] || "0" : manual || "0";
}
export function canChangeAccountRow(source: AmountSource): boolean {
  try { return kindIds.every(kind => Array.from({ length: 12 }, (_, i) => i + 1).every(month => amountToYen(resolvedAmount(source, kind, month)) === 0)); }
  catch { return false; }
}
export function readPlanSettings(db: Database): PlanSettings {
  const [year] = db.exec("SELECT fiscal_year FROM budgets WHERE id = 1")[0]!.values[0]!;
  const kindSelections: KindSelections = { "initiative-list": [2], "cost-table": [1], "expansion-table": [1] };
  for (const [screen, first, second] of db.exec("SELECT screen, first_kind, second_kind FROM kind_selections")[0]?.values ?? []) {
    kindSelections[String(screen) as KindScreen] = [Number(first) as KindId, ...(second === null ? [] : [Number(second) as KindId])];
  }
  const previousAmounts = (db.exec("SELECT account_id, industry_id, department_id, month, amount_yen, revision FROM previous_amounts ORDER BY industry_id, department_id, account_id, month")[0]?.values ?? [])
    .map(([account, industry, department, month, amount, revision]) => ({ accountId: Number(account), industryId: Number(industry), departmentId: Number(department), month: Number(month), amount: yenToAmount(Number(amount)), revision: Number(revision) }));
  return { fiscalYear: Number(year), kindSelections, previousAmounts };
}
export function readRowOverrides(db: Database, rowId: number): KindOverrides {
  const result: KindOverrides = {};
  for (const [kind, month, amount] of db.exec("SELECT kind_id, month, amount_yen FROM amount_overrides WHERE row_id = ?", [rowId])[0]?.values ?? []) {
    const id = Number(kind) as KindId;
    (result[id] ??= {})[Number(month)] = yenToAmount(Number(amount));
  }
  return result;
}

async function editPlan(bytes: Uint8Array, change: (db: Database) => void): Promise<Uint8Array> {
  const db = await openTriadicDatabase(bytes);
  try {
    db.run("BEGIN");
    change(db);
    db.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    db.run("COMMIT");
    return exportTriadicDatabase(db);
  } finally { db.close(); }
}
export async function saveKindSelection(bytes: Uint8Array, screen: KindScreen, selected: KindId[]): Promise<Uint8Array> {
  if (!["initiative-list", "cost-table", "expansion-table"].includes(screen)) throw new Error("表示対象が正しくありません。");
  const maximum = screen === "initiative-list" ? 1 : 2;
  if (selected.length < 1 || selected.length > maximum || new Set(selected).size !== selected.length || selected.some(id => !isKindId(id))) throw new Error("種別の選択が正しくありません。");
  return editPlan(bytes, db => db.run("UPDATE kind_selections SET first_kind = ?, second_kind = ? WHERE screen = ?", [selected[0]!, selected[1] ?? null, screen]));
}
export type PreviousInput = { invalidNumbers?: boolean; industryId: number; departmentId: number; rows: { accountId: number; amounts: MonthAmounts }[] };
export type PlanChange = { type: "previous"; input: PreviousInput } | { type: "selection"; screen: KindScreen; selected: KindId[] };
export async function changePlanSettings(bytes: Uint8Array, change: PlanChange): Promise<Uint8Array> {
  if (change.type === "previous") return savePreviousAmounts(bytes, change.input);
  return saveKindSelection(bytes, change.screen, change.selected);
}
export async function savePreviousAmounts(bytes: Uint8Array, input: PreviousInput): Promise<Uint8Array> {
  if (input.invalidNumbers) throw new Error("金額に有効な数値を入力してください。");
  if (new Set(input.rows.map(row => row.accountId)).size !== input.rows.length) throw new Error("同じ勘定科目が重複しています。");
  return editPlan(bytes, db => {
    if (!db.exec("SELECT id FROM industries WHERE id = ?", [input.industryId]).length) throw new Error("業種名を選択してください。");
    if (!db.exec("SELECT id FROM departments WHERE id = ?", [input.departmentId]).length) throw new Error("部署名を選択してください。");
    for (const row of input.rows) {
      if (!db.exec("SELECT id FROM accounts WHERE id = ?", [row.accountId]).length) throw new Error("勘定科目が見つかりません。");
      for (const [month, text] of Object.entries(row.amounts)) {
        const amount = amountToYen(text || "0");
        db.run(`INSERT INTO previous_amounts (account_id, industry_id, department_id, month, amount_yen) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (account_id, industry_id, department_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = previous_amounts.revision + 1`, [row.accountId, input.industryId, input.departmentId, Number(month), amount]);
      }
    }
  });
}
