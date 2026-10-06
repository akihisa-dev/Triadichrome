import { amountToYen, yenToAmount } from "./amounts";
import { initiativeMonths } from "./initiatives";
import type { PreviousInput } from "./kindAmounts";

export type GridCell = { row: number; column: number };
export type GridSelection = { anchor: GridCell; end: GridCell };
export function gridBounds(selection: GridSelection) {
  return { top: Math.min(selection.anchor.row, selection.end.row), bottom: Math.max(selection.anchor.row, selection.end.row),
    left: Math.min(selection.anchor.column, selection.end.column), right: Math.max(selection.anchor.column, selection.end.column) };
}
export function normalizeGridAmount(text: string): string {
  const value = text.trim();
  if (!value) return "0";
  // Accept Excel's thousands separators, but reject malformed grouping.
  if (value.includes(",") && !/^[+-]?\d{1,3}(,\d{3})+(\.\d{0,3})?$/.test(value)) throw new Error("金額の桁区切りが正しくありません。");
  return yenToAmount(amountToYen(value.replaceAll(",", "")));
}
/** Validate the whole rectangle before returning a new draft; never partially apply a paste. */
export function pastePreviousGrid(draft: PreviousInput, rowIds: (number | null)[], start: GridCell, text: string): PreviousInput {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n").map(line => line.split("\t"));
  const width = lines[0]!.length;
  if (lines.some(line => line.length !== width)) throw new Error("貼り付ける範囲の列数を揃えてください。");
  if (start.row < 0 || start.column < 0 || start.row + lines.length > rowIds.length || start.column + width > initiativeMonths.length) throw new Error("貼り付ける範囲が表の外にはみ出します。");
  const updates = new Map<number, Record<number, string>>();
  for (const [offset, line] of lines.entries()) {
    const id = rowIds[start.row + offset];
    if (id == null) throw new Error("小計・合計・利益率には貼り付けできません。科目行の範囲を選んでください。");
    const amounts: Record<number, string> = {};
    for (const [column, value] of line.entries()) amounts[initiativeMonths[start.column + column]!] = normalizeGridAmount(value);
    updates.set(id, amounts);
  }
  return { ...draft, rows: draft.rows.map(row => updates.has(row.accountId) ? { ...row, amounts: { ...row.amounts, ...updates.get(row.accountId) } } : row) };
}
export function fillPreviousGrid(draft: PreviousInput, rowIds: (number | null)[], selection: GridSelection, text: string): PreviousInput {
  const value = normalizeGridAmount(text);
  const bounds = gridBounds(selection);
  const selectedIds = new Set(rowIds.slice(bounds.top, bounds.bottom + 1).filter(id => id !== null));
  return { ...draft, rows: draft.rows.map(row => selectedIds.has(row.accountId) ? { ...row, amounts: { ...row.amounts,
    ...Object.fromEntries(initiativeMonths.slice(bounds.left, bounds.right + 1).map(month => [month, value])) } } : row) };
}
