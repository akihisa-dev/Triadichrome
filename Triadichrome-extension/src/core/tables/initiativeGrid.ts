import { initiativeMonths } from "../domain/calendar";
import { type InitiativeEntryDraft } from "../domain/plan";
import { isKindId, type KindId } from "../domain/kinds";
import { gridBounds, normalizeGridAmount, type GridCell, type GridSelection } from "./previousGrid";

export function canEditInitiativeCell(draft: InitiativeEntryDraft, kind: KindId, cell: GridCell): boolean {
  return isKindId(kind) && Number.isInteger(cell.row) && Number.isInteger(cell.column) && cell.row >= 0 && cell.column >= 0
    && cell.column < initiativeMonths.length && draft.rows[cell.row]?.accountId != null
;
}

function applyRectangle(draft: InitiativeEntryDraft, kind: KindId, start: GridCell, values: string[][]): InitiativeEntryDraft {
  if (!isKindId(kind)) throw new Error("種別が正しくありません。");
  const width = values[0]!.length;
  if (values.some(row => row.length !== width)) throw new Error("貼り付ける範囲の列数を揃えてください。");
  if (![start.row, start.column].every(Number.isInteger) || start.row < 0 || start.column < 0
    || start.row + values.length > draft.rows.length || start.column + width > initiativeMonths.length) {
    throw new Error("入力する範囲が表の外にはみ出します。");
  }
  // Validate all cells first, including locked months and unassigned account rows.
  const updates = values.map((line, offset) => Object.fromEntries(line.map((text, column) => {
    const cell = { row: start.row + offset, column: start.column + column };
    if (draft.rows[cell.row]!.accountId == null) throw new Error("入力する行の勘定科目を選択してください。");
    return [initiativeMonths[cell.column]!, normalizeGridAmount(text)];
  })));
  return { ...draft, rows: draft.rows.map((row, index) => {
    const amounts = updates[index - start.row];
    if (!amounts) return row;
    return kind === 1 ? { ...row, amounts: { ...row.amounts, ...amounts } }
      : { ...row, overrides: { ...row.overrides, [kind]: { ...row.overrides?.[kind], ...amounts } } };
  }) };
}

export function pasteInitiativeGrid(draft: InitiativeEntryDraft, kind: KindId, start: GridCell, text: string): InitiativeEntryDraft {
  const values = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n").map(line => line.split("\t"));
  return applyRectangle(draft, kind, start, values);
}

export function fillInitiativeGrid(draft: InitiativeEntryDraft, kind: KindId, selection: GridSelection, text: string): InitiativeEntryDraft {
  const { top, bottom, left, right } = gridBounds(selection);
  if (![top, bottom, left, right].every(Number.isInteger) || top < 0 || left < 0 || bottom >= draft.rows.length || right >= initiativeMonths.length) {
    throw new Error("入力する範囲が表の外にはみ出します。");
  }
  return applyRectangle(draft, kind, { row: top, column: left },
    Array.from({ length: bottom - top + 1 }, () => Array<string>(right - left + 1).fill(text)));
}

/** Clear this initiative's confirmed adjustments and resume following its primary budget. */
export function reflectPrimaryBudget(draft: InitiativeEntryDraft): InitiativeEntryDraft {
  return { ...draft, rows: draft.rows.map(row => {
    const overrides = { ...row.overrides };
    delete overrides[2];
    return { ...row, overrides };
  }) };
}
