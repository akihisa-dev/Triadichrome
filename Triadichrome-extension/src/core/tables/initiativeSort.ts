import type { Initiative } from "../domain/plan";
import type { KindId } from "../domain/kinds";

export type InitiativeSort = { column: "expansion" | "period" | "name" | "start"; direction: "ascending" | "descending" };
const names = new Intl.Collator("ja", { numeric: true });

/** Sort a view without changing the saved registration order. Empty values stay last. */
export function sortInitiatives(source: Initiative[], sort: InitiativeSort | null, kind: KindId,
  expansionNames: ReadonlyMap<number, string>, periodNames: ReadonlyMap<number, string>): Initiative[] {
  if (!sort) return source;
  const value = (item: Initiative) => {
    switch (sort.column) {
      case "expansion": return expansionNames.get(item.expansionId ?? -1) ?? "";
      case "period": return periodNames.get(item.periodTypeId ?? -1) ?? "";
      case "name": return item.name;
      case "start": return item.startYearMonths[kind] ?? "";
    }
  };
  return source.map((item, index) => ({ item, index, value: value(item) })).sort((a, b) => {
    if (!a.value || !b.value) return Number(!a.value) - Number(!b.value) || a.index - b.index;
    const compared = sort.column === "start"
      ? monthNumber(a.value) - monthNumber(b.value)
      : names.compare(a.value, b.value);
    return compared * (sort.direction === "ascending" ? 1 : -1) || a.index - b.index;
  }).map(({ item }) => item);
}

function monthNumber(value: string): number {
  const [year, month] = value.split("-").map(Number);
  return year! * 12 + month!;
}
