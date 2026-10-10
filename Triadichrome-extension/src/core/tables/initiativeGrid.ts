import { type Account } from "../domain/accountMaster";
import { amountItems } from "../domain/amountItems";
import { amountToYen, checkedYen } from "../domain/amounts";
import { initiativeMonths } from "../domain/calendar";
import { type InitiativeEntryDraft, type InitiativeRow } from "../domain/plan";
import { hasInvalidAmountInput, isKindId, resolvedAmount, type InvalidAmountInput, type KindId, type MonthAmounts } from "../domain/kinds";
import { gridBounds, normalizeGridAmount, type GridCell, type GridSelection } from "./previousGrid";

export function canEditInitiativeCell(draft: InitiativeEntryDraft, kind: KindId, cell: GridCell): boolean {
  return isKindId(kind) && Number.isInteger(cell.row) && Number.isInteger(cell.column) && cell.row >= 0 && cell.column >= 0
    && cell.column < initiativeMonths.length && draft.rows[cell.row]?.accountId != null
;
}

function updateInputErrors(row: InitiativeRow, kind: KindId, months: number[], invalidInput?: InvalidAmountInput): InitiativeRow {
  const invalidAmounts = { ...row.invalidAmounts }, errors = { ...invalidAmounts[kind] };
  for (const month of months) {
    if (invalidInput) errors[month] ??= invalidInput;
    else delete errors[month];
  }
  if (Object.keys(errors).length) invalidAmounts[kind] = errors;
  else delete invalidAmounts[kind];
  const { invalidAmounts: _previous, ...source } = row;
  return { ...source, ...(Object.keys(invalidAmounts).length ? { invalidAmounts } : {}) };
}
function updateRowAmounts(row: InitiativeRow, kind: KindId, amounts: MonthAmounts, invalidInput?: InvalidAmountInput): InitiativeRow {
  return { ...updateInputErrors(row, kind, Object.keys(amounts).map(Number), invalidInput),
    ...(kind === 1 ? { amounts: { ...row.amounts, ...amounts } }
      : { overrides: { ...row.overrides, [kind]: { ...row.overrides?.[kind], ...amounts } } }) };
}

export function changeInitiativeCell(draft: InitiativeEntryDraft, kind: KindId, cell: GridCell, value: string, invalidInput?: InvalidAmountInput): InitiativeEntryDraft {
  if (!canEditInitiativeCell(draft, kind, cell)) return draft;
  const month = initiativeMonths[cell.column]!;
  return { ...draft, rows: draft.rows.map((row, index) => index === cell.row ? updateRowAmounts(row, kind, { [month]: value }, invalidInput) : row) };
}

/** Cancel only this cell, including after a budget-tab remount, without freezing an inherited value. */
export function cancelInitiativeCell(draft: InitiativeEntryDraft, kind: KindId, cell: GridCell, fallback: InvalidAmountInput): InitiativeEntryDraft {
  if (!canEditInitiativeCell(draft, kind, cell)) return draft;
  const month = initiativeMonths[cell.column]!, source = draft.rows[cell.row]!;
  const original = source.invalidAmounts?.[kind]?.[month] ?? fallback;
  const next = changeInitiativeCell(draft, kind, cell, original.original);
  if (kind !== 2 || !original.inherited) return next;
  return { ...next, rows: next.rows.map((row, index) => {
    if (index !== cell.row) return row;
    const overrides = { ...row.overrides }, amounts = { ...overrides[2] };
    delete amounts[month];
    if (Object.keys(amounts).length) overrides[2] = amounts;
    else delete overrides[2];
    return { ...row, overrides };
  }) };
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
    return updateRowAmounts(row, kind, amounts);
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
    return { ...updateInputErrors(row, 2, [...initiativeMonths]), overrides };
  }) };
}

/** Apply the same fixed composition used by the amount item master, before display rounding. */
export function initiativeAmountTotals(draft: InitiativeEntryDraft, kind: KindId, accounts: Account[]) {
  const accountById = new Map(accounts.map(account => [account.id, account]));
  let error = "";
  const invalidNumbers = draft.invalidNumbers || draft.rows.some(hasInvalidAmountInput);
  const rows = amountItems.map(item => {
    const sources = draft.rows.flatMap(row => {
      const attribute = row.accountId === null ? undefined : accountById.get(row.accountId)?.accountType;
      const component = item.components.find(component => component.attribute === attribute);
      return component ? [{ row, sign: component.sign }] : [];
    });
    const amounts = Object.fromEntries(initiativeMonths.map(month => {
      if (invalidNumbers) return [month, undefined];
      try {
        const total = sources.reduce((sum, { row, sign }) => sum + BigInt(amountToYen(resolvedAmount(row, kind, month))) * BigInt(sign), 0n);
        return [month, checkedYen(total)];
      } catch (failure) {
        error = `金額項目の合計を計算できません。${failure instanceof Error ? failure.message : "金額を確認してください。"}`;
        return [month, undefined];
      }
    }));
    return { id: item.id, name: item.name, amounts };
  });
  return { rows, error };
}
