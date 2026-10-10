import { sumYen } from "../domain/amounts";
import type { CostRow } from "./costTable";
import { initiativeMonths } from "../domain/calendar";
import type { TablePeriod } from "./periodTables";

export const previousPeriods: TablePeriod[] = [
  { id: "half-1", label: "上期", months: initiativeMonths.slice(0, 6) },
  { id: "half-2", label: "下期", months: initiativeMonths.slice(6) },
  { id: "annual", label: "通期", months: initiativeMonths },
];

/** Sum original yen, and calculate a period rate from its sales and profit. */
export function previousPeriodAmount(row: CostRow, period: TablePeriod, sales?: CostRow, profit?: CostRow): number | undefined {
  if (!row.configured) return undefined;
  const total = (source: CostRow) => sumYen(period.months.map(month => source.previous[month] ?? 0));
  if (row.kind !== "ratio") return total(row);
  if (!sales?.configured || !profit?.configured) return undefined;
  const denominator = total(sales);
  return denominator === 0 ? undefined : total(profit) / denominator * 100;
}
