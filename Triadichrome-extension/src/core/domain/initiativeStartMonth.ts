import { amountToYen } from "./amounts";
import { calendarYear, initiativeMonths } from "./calendar";
import { resolvedAmount, type AmountSource, type KindId } from "./kinds";

export type StartMonthRule = "new" | "period_gap";
export type InitiativeStartMonths = Record<KindId, string | null>;

export function startMonthRuleForName(name: string): StartMonthRule | null {
  return name === "新規" ? "new" : name === "期間差" ? "period_gap" : null;
}

/** Use each row before aggregation so opposite amounts cannot hide an active month. */
export function deriveStartYearMonth(fiscalYear: number, rule: StartMonthRule | null, rows: AmountSource[], kind: KindId): string | null {
  if (rule === null) return null;
  const active = initiativeMonths.map(month => rows.some(row => amountToYen(resolvedAmount(row, kind, month)) !== 0));
  let index: number;
  let year = fiscalYear;
  if (rule === "new") {
    index = active.indexOf(true);
    if (index < 0) return null;
  } else {
    // Zero months within the carryover span do not interrupt its duration.
    index = active.lastIndexOf(true) + 1;
    if (!active[0] || index >= initiativeMonths.length) return null;
    year -= 1;
  }
  const month = initiativeMonths[index]!;
  const startYear = calendarYear(year, month);
  if (startYear < 1) return null;
  return `${String(startYear).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}
