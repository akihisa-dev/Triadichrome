import type { KindId } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";
import { groupExpansionPeriods } from "./expansionTable";
import { buildKindExpansionTable } from "./planTables";

function buildView(contents: PlanContents, selected: KindId[]) {
  const table = buildKindExpansionTable(contents, selected, "registered");
  const groups = table.groups.map(group => ({ group, periods: groupExpansionPeriods(group.initiatives, contents.periodTypes) }));
  const flat = groups.flatMap(({ group, periods }) => {
    const count = group.initiatives.length + 1;
    let offset = 0;
    const items = periods.flatMap(period => period.initiatives.map((item, index) => ({
      group, item, period, groupOffset: offset++, groupCount: count, periodOffset: index, subtotal: false,
    })));
    return [...items, { group, item: null, period: null, groupOffset: offset, groupCount: count, periodOffset: 0, subtotal: true }];
  });
  return { table, groups, flat };
}

// The caller replaces this cache whenever immutable calculation inputs change.
// Selection order is significant; at most four valid combinations are retained.
export function createExpansionTableView(contents: PlanContents) {
  const cache = new Map<string, ReturnType<typeof buildView>>();
  return (selected: KindId[]) => {
    const key = selected.join(",");
    let view = cache.get(key);
    if (!view) {
      view = buildView(contents, selected);
      cache.set(key, view);
    }
    return view;
  };
}
