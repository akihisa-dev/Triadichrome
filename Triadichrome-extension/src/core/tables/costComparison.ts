import { addAmounts } from "../domain/amounts";
import { initiativeMonths } from "../domain/calendar";
import type { KindId } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";
import { buildKindCostTable } from "./planTables";

/** Display budgets in business order, with differences calculated before rounding. */
export function buildCostComparison(contents: PlanContents, selected: KindId[]) {
  const kinds = [...selected].sort((left, right) => left - right);
  const rows = buildKindCostTable(contents, kinds);
  const labels = ["前年", ...kinds.map(id => contents.kinds.find(kind => kind.id === id)!.kindName), "前年差", ...(kinds.length === 2 ? ["一次予算差"] : [])];
  return { labels, rows: rows.map(row => {
    const difference = (left: typeof row.previous, right: typeof row.previous) => Object.fromEntries(
      initiativeMonths.flatMap(month => left[month] === undefined || right[month] === undefined ? [] :
        [[month, row.kind === "ratio" ? left[month]! - right[month]! : addAmounts(left[month]!, -right[month]!)]]));
    const latest = row.values[row.values.length - 1]!;
    return { ...row, values: [...row.values, difference(latest, row.previous),
      ...(kinds.length === 2 ? [difference(latest, row.values[1]!)] : [])] };
  }) };
}
