import { amountToYen, formatAmount } from "./amounts";
export type TableView = { sort: { column: string; direction: "asc" | "desc" } | null; filters: Record<string, string[]> };
export const emptyTableView = (): TableView => ({ sort: null, filters: {} });
export type TableColumn<T> = { id: string; label: string; value: (row: T) => string | number | null; numeric?: boolean; amount?: boolean; display?: (row: T) => string };
export const tableValue = (value: string | number | null) => value === null ? "未選択" : String(value);
export const tableDisplayValue = <T>(column: TableColumn<T>, row: T) => {
  const value = column.value(row);
  return column.display ? column.display(row) : column.amount && value !== null ? formatAmount(value) : tableValue(value);
};
const collator = new Intl.Collator("ja", { numeric: true });
export function applyTableView<T>(rows: T[], columns: TableColumn<T>[], view: TableView): T[] {
  const definitions = new Map(columns.map(column => [column.id, column]));
  const conditions = Object.entries(view.filters).map(([id, values]) => ({ column: definitions.get(id), values: new Set(values) }));
  const result = rows.filter(row => conditions.every(({ column, values }) => !column || values.has(tableDisplayValue(column, row))));
  const selected = view.sort && definitions.get(view.sort.column);
  if (selected && view.sort) {
    const direction = view.sort.direction === "asc" ? 1 : -1;
    result.sort((a, b) => {
      const left = selected.value(a), right = selected.value(b);
      if (left === null || right === null) return left === right ? 0 : left === null ? direction : -direction;
      const comparison = selected.numeric ? (typeof left === "string" ? amountToYen(left) : left * 1000) - (typeof right === "string" ? amountToYen(right) : right * 1000) : collator.compare(String(left), String(right));
      return comparison * direction;
    });
  }
  return result;
}
