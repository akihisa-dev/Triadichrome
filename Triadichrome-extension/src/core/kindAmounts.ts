import type { Database } from "sql.js";
import { amountToYen, yenToAmount } from "./amounts";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";

export const kindIds = [1, 2, 3, 4, 5] as const;
export type KindId = typeof kindIds[number];
export type MonthAmounts = Partial<Record<number, string>>;
export type KindOverrides = Partial<Record<KindId, MonthAmounts>>;
export type AmountSource = { amounts: MonthAmounts; overrides?: KindOverrides };
export type KindScreen = "initiative-list" | "cost-table" | "expansion-table";
export type KindSelections = Record<KindScreen, KindId[]>;
export type PreviousAmount = { accountId: number; industryId: number; departmentId: number; month: number; amount: string; revision: number };
export type PlanSettings = { fiscalYear: number; revisedActive: boolean; kindSelections: KindSelections; previousAmounts: PreviousAmount[] };

export function isKindId(value: number): value is KindId { return kindIds.some(id => id === value); }
export function isLateMonth(month: number): boolean { return month >= 10 || month <= 3; }
export function parentKind(kind: KindId, month: number, revisedActive: boolean): KindId | null {
  if (kind === 1) return null;
  if (kind === 2) return 1;
  if (kind === 3) return isLateMonth(month) ? 2 : 5;
  if (kind === 4) return revisedActive && isLateMonth(month) ? 3 : 2;
  return 4;
}
export function resolvedAmount(source: AmountSource, kind: KindId, month: number, revisedActive: boolean): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("対象月が正しくありません。");
  if (kind === 1) return source.amounts[month] || "0";
  const manual = source.overrides?.[kind]?.[month];
  if (manual !== undefined && !(kind === 3 && !isLateMonth(month))) return manual || "0";
  return resolvedAmount(source, parentKind(kind, month, revisedActive)!, month, revisedActive);
}
export function canChangeAccountRow(source: AmountSource, revisedActive: boolean): boolean {
  try { return kindIds.every(kind => Array.from({ length: 12 }, (_, i) => i + 1).every(month => amountToYen(resolvedAmount(source, kind, month, revisedActive)) === 0)); }
  catch { return false; }
}
/** Clicking a third kind evicts the oldest choice while retaining selection order. */
export function toggleKindSelection(selected: KindId[], kind: KindId, maximum: number, minimum = 0): KindId[] {
  if (selected.includes(kind)) return selected.length > minimum ? selected.filter(id => id !== kind) : selected;
  return [...selected, kind].slice(-maximum);
}
export function readPlanSettings(db: Database): PlanSettings {
  const [year, active] = db.exec("SELECT fiscal_year, revised_active FROM budgets WHERE id = 1")[0]!.values[0]!;
  const kindSelections: KindSelections = { "initiative-list": [2], "cost-table": [2, 4], "expansion-table": [2, 4] };
  for (const [screen, first, second] of db.exec("SELECT screen, first_kind, second_kind FROM kind_selections")[0]?.values ?? []) {
    kindSelections[String(screen) as KindScreen] = [Number(first) as KindId, ...(second === null ? [] : [Number(second) as KindId])];
  }
  const previousAmounts = (db.exec("SELECT account_id, industry_id, department_id, month, amount_yen, revision FROM previous_amounts ORDER BY industry_id, department_id, account_id, month")[0]?.values ?? [])
    .map(([account, industry, department, month, amount, revision]) => ({ accountId: Number(account), industryId: Number(industry), departmentId: Number(department), month: Number(month), amount: yenToAmount(Number(amount)), revision: Number(revision) }));
  return { fiscalYear: Number(year), revisedActive: active === 1, kindSelections, previousAmounts };
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
export async function setRevisedBudgetActive(bytes: Uint8Array, active: boolean): Promise<Uint8Array> {
  return editPlan(bytes, db => db.run("UPDATE budgets SET revised_active = ?, revision = revision + 1 WHERE id = 1", [active ? 1 : 0]));
}
export async function saveKindSelection(bytes: Uint8Array, screen: KindScreen, selected: KindId[]): Promise<Uint8Array> {
  const maximum = screen === "initiative-list" ? 1 : 2;
  if (selected.length < 1 || selected.length > maximum || (screen === "expansion-table" && selected.length !== 2) || new Set(selected).size !== selected.length || selected.some(id => !isKindId(id))) throw new Error("種別の選択が正しくありません。");
  return editPlan(bytes, db => db.run("UPDATE kind_selections SET first_kind = ?, second_kind = ? WHERE screen = ?", [selected[0]!, selected[1] ?? null, screen]));
}
export type PreviousInput = { invalidNumbers?: boolean; industryId: number; departmentId: number; rows: { accountId: number; amounts: MonthAmounts }[] };
export type PlanChange = { type: "previous"; input: PreviousInput } | { type: "revised"; active: boolean } | { type: "selection"; screen: KindScreen; selected: KindId[] };
export async function changePlanSettings(bytes: Uint8Array, change: PlanChange): Promise<Uint8Array> {
  if (change.type === "previous") return savePreviousAmounts(bytes, change.input);
  if (change.type === "revised") return setRevisedBudgetActive(bytes, change.active);
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
