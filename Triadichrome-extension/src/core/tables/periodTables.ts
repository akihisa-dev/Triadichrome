import { addYen } from "../domain/amounts";
import { initiativeMonths, type InitiativeMonth } from "../domain/calendar";
import type { KindId } from "../domain/kinds";
import type { Initiative, PlanContents } from "../domain/plan";
import { buildCostComparison } from "./costComparison";

export type TablePeriod = { id: string; label: string; months: readonly InitiativeMonth[] };
const quarter = (index: number): TablePeriod => ({ id: `quarter-${index + 1}`, label: `第${index + 1}四半期計`, months: initiativeMonths.slice(index * 3, index * 3 + 3) });
const half = (index: number): TablePeriod => ({ id: `half-${index + 1}`, label: index === 0 ? "上期計" : "下期計", months: initiativeMonths.slice(index * 6, index * 6 + 6) });
export const tablePeriods: TablePeriod[] = initiativeMonths.flatMap((month, index) => [
  { id: String(month), label: `${month}月`, months: [month] },
  ...(index % 3 === 2 ? [quarter(Math.floor(index / 3))] : []),
  ...(index % 6 === 5 ? [half(Math.floor(index / 6))] : []),
  ...(index === 11 ? [{ id: "annual", label: "年間計", months: initiativeMonths }] : []),
]);

function sumPeriod(values: Partial<Record<InitiativeMonth, number>>, period: TablePeriod): number {
  return period.months.reduce((sum, month) => addYen(sum, values[month] ?? 0), 0);
}

/** Aggregate original amounts before display rounding; recompute rates from period totals. */
export function buildPeriodCostComparison(contents: PlanContents, selected: KindId[]) {
  const table = buildCostComparison(contents, selected);
  const sales = table.rows.find(row => row.kind === "group" && row.id === contents.aggregations.find(group => group.required === "sales")?.id)!;
  const profit = table.rows.find(row => row.kind === "group" && row.id === contents.aggregations.find(group => group.required === "ordinary")?.id)!;
  return { labels: table.labels, rows: table.rows.map(row => {
    const values: Record<string, number | undefined>[] = row.values.map(() => ({}));
    for (const period of tablePeriods) {
      if (period.months.length === 1) {
        row.values.forEach((source, index) => { values[index]![period.id] = source[period.months[0]!]; });
        continue;
      }
      if (!row.configured) continue;
      for (let index = 0; index <= selected.length; index++) {
        if (row.kind !== "ratio") values[index]![period.id] = sumPeriod(row.values[index]!, period);
        else {
          const denominator = sumPeriod(sales.values[index]!, period);
          const numerator = sumPeriod(profit.values[index]!, period);
          if (denominator !== 0) values[index]![period.id] = numerator / denominator * 100;
        }
      }
      const latest = values[selected.length]![period.id];
      const difference = (right: number | undefined) => latest === undefined || right === undefined ? undefined
        : row.kind === "ratio" ? latest - right : addYen(latest, -right);
      values[selected.length + 1]![period.id] = difference(values[0]![period.id]);
      if (selected.length === 2) values[4]![period.id] = difference(values[1]![period.id]);
    }
    return { ...row, values };
  }) };
}

export function expansionPeriodAmount(months: Initiative["months"], period: TablePeriod, metric: "sales" | "profit"): number | null {
  if (period.months.some(month => months[month]?.[metric] === null)) return null;
  return period.months.reduce((sum, month) => addYen(sum, months[month]?.[metric] ?? 0), 0);
}
