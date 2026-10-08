import { amountToYen } from "../domain/amounts";
import type { TableColumn } from "./tableView";

export type TableSort = { column: string; direction: "ascending" | "descending" };
const names = new Intl.Collator("ja", { numeric: true });

/** Keep empty values last and ties in source order, without mutating saved data. */
export function sortTableRows<T>(source: T[], columns: TableColumn<T>[], sort: TableSort | null): T[] {
  const column = columns.find(item => item.id === sort?.column);
  if (!sort || !column) return source;
  const direction = sort.direction === "ascending" ? 1 : -1;
  return source.map((row, index) => {
    const raw = column.value(row);
    const value = raw === null || raw === "" ? null : column.amount ? amountToYen(String(raw)) : column.numeric ? Number(raw) : String(raw);
    return { row, index, value };
  }).sort((a, b) => {
    if (a.value === null || b.value === null) return Number(a.value === null) - Number(b.value === null) || a.index - b.index;
    const compared = typeof a.value === "number" && typeof b.value === "number"
      ? a.value - b.value : names.compare(String(a.value), String(b.value));
    return compared * direction || a.index - b.index;
  }).map(item => item.row);
}
