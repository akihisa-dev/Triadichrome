import type { StartMonthRule } from "./initiativeStartMonth";
export type PeriodType = { id: number; periodName: string; startMonthRule?: StartMonthRule | null };
export type PeriodTypeChange =
  | { type: "add"; periodName: string }
  | { type: "update"; id: number; periodName: string }
  | { type: "delete"; id: number };

export function validatePeriodTypeChange(items: PeriodType[], change: PeriodTypeChange): void {
  if (change.type !== "add" && !items.some(item => item.id === change.id)) throw new Error("期間が見つかりません。");
  if (change.type === "delete") return;
  const name = change.periodName.trim();
  if (!name) throw new Error("期間名を入力してください。");
  const others = items.filter(item => change.type === "add" || item.id !== change.id);
  if (others.some(item => item.periodName === name)) throw new Error("同じ期間名が登録されています。");
}
