import { formatAmount } from "../domain/amounts";
export type TableColumn<T> = { id: string; label: string; value: (row: T) => string | number | null; numeric?: boolean; amount?: boolean; display?: (row: T) => string };
export const tableValue = (value: string | number | null) => value === null ? "未選択" : String(value);
export const tableDisplayValue = <T>(column: TableColumn<T>, row: T) => {
  const value = column.value(row);
  return column.display ? column.display(row) : column.amount && value !== null ? formatAmount(value) : tableValue(value);
};
