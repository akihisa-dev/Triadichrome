import type { TablePeriod } from "../core/tables/periodTables";
import "./PeriodColumns.css";

export function periodCellClass(period: TablePeriod, first = false, last = false): string {
  const kind = period.months.length === 12 ? "annual" : period.months.length === 6 ? "half" : period.months.length === 3 ? "quarter" : "month";
  return [`period-${kind}`, ...(kind !== "month" && first ? ["period-start"] : []), ...(last ? ["initiative-month-end"] : [])].join(" ");
}
