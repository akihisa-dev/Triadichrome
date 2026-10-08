import { useGridInteraction } from "./useGridInteraction";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useEffect, useState } from "react";
import { canChangeAccountRow, resolvedAmount, type KindId } from "../core/domain/kinds";
import { accountTypes } from "../core/domain/accountTypes";
import { formatYen, isValidAmount } from "../core/domain/amounts";
import { initiativeMonths as months } from "../core/domain/calendar";
import { type InitiativeEntryDraft } from "../core/domain/plan";
import { type Account } from "../core/domain/accountMaster";
import { canEditInitiativeCell, fillInitiativeGrid, pasteInitiativeGrid, initiativeAttributeTotals } from "../core/tables/initiativeGrid";
import { normalizeGridAmount, type GridCell } from "../core/tables/previousGrid";
import { StatusNotice } from "./StatusNotice";
import "./InitiativeAmountGrid.css";

export function InitiativeAmountGrid({ draft, kind, accounts, isSaving, onDraftChange }: {
  draft: InitiativeEntryDraft; kind: KindId; accounts: Account[];
  isSaving: boolean; onDraftChange: (draft: InitiativeEntryDraft) => void;
}) {
  const readOnly = useHistoryReadOnly();
  const { selection, setSelection, editing, setEditing, table, dragging, original, bounds, focus } = useGridInteraction();
  const [error, setError] = useState("");
  const totals = initiativeAttributeTotals(draft, kind, accounts);
  useEffect(() => { setSelection(null); setEditing(false); }, [draft.rows.length]);
  const valueAt = (cell: GridCell, source = draft) => {
    const row = source.rows[cell.row]!;
    const month = months[cell.column]!;
    return kind === 1 ? row.amounts[month] ?? "0" : row.overrides?.[kind]?.[month] ?? resolvedAmount(row, kind, month);
  };
  const apply = (operation: () => InitiativeEntryDraft) => {
    if (readOnly || isSaving) return;
    try {
      const next = operation();
      const invalidNumbers = [...table.current!.querySelectorAll<HTMLInputElement>("input")].some(input => {
        const cell = { row: Number(input.dataset.row), column: Number(input.dataset.column) };
        return input.validity.badInput && valueAt(cell) === valueAt(cell, next);
      });
      onDraftChange({ ...next, invalidNumbers }); setError(""); setEditing(false);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : "入力できませんでした。"); }
  };
  const changeCell = (cell: GridCell, value: string, invalidNumbers = draft.invalidNumbers ?? false) => {
    if (isSaving || !canEditInitiativeCell(draft, kind, cell)) return;
    const month = months[cell.column]!;
    onDraftChange({ ...draft, invalidNumbers, rows: draft.rows.map((row, index) => index !== cell.row ? row
      : kind === 1 ? { ...row, amounts: { ...row.amounts, [month]: value } }
      : { ...row, overrides: { ...row.overrides, [kind]: { ...row.overrides?.[kind], [month]: value } } }) });
  };
  return <>
    <StatusNotice message={error || totals.error} error {...(error ? { onDismiss: () => setError("") } : {})} />
        <table ref={table} className="initiative-amount-table" aria-label="月別計画金額">
          <thead>
            <tr>
              <th scope="col">勘定科目</th>
              {months.map(month => <th key={month} scope="col">{month}月</th>)}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, index) => {
              const accountName = accounts.find(account => account.id === row.accountId)?.accountName ?? `${index + 1}行目`;
              return <tr key={row.id ?? index}>
                <th scope="row">
                  <div className="initiative-account-cell">
                  <select aria-label={`${index + 1}行目の勘定科目`} value={row.accountId ?? ""} disabled={readOnly || isSaving || accounts.length === 0 || !canChangeAccountRow(row)}
                    onChange={event => onDraftChange({ ...draft, rows: draft.rows.map((current, currentIndex) => currentIndex === index
                      ? { ...current, accountId: event.target.value ? Number(event.target.value) : null } : current) })}>
                    <option value="">科目を選択</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.accountCode ?? "未設定"} {account.accountName}</option>)}
                  </select>
                  <button type="button" className="text-button" aria-label={`${index + 1}行目を削除`} disabled={readOnly || isSaving || !canChangeAccountRow(row)} onClick={() => onDraftChange({ ...draft, rows: draft.rows.filter((_, position) => position !== index) })}>削除</button>
                  </div>
                </th>
                {months.map((month, column) => {
                  const cell = { row: index, column };
                  const value = valueAt(cell);
                  const selected = bounds && index >= bounds.top && index <= bounds.bottom && column >= bounds.left && column <= bounds.right;
                  return <td key={month} className={selected ? "initiative-cell-selected" : undefined}
                    onPointerEnter={() => { if (dragging.current) setSelection(current => current ? { ...current, end: cell } : null); }}
                    onPointerDown={event => {
                      if (isSaving || event.button !== 0 || (event.target as HTMLElement).closest("button")
                        || (editing && selection?.end.row === index && selection.end.column === column && !event.shiftKey)) return;
                      event.preventDefault(); dragging.current = true; focus(cell, event.shiftKey);
                    }}>
                    <input type="number" step="0.001" inputMode="decimal" data-row={index} data-column={column}
                      ref={input => { if (input) input.setCustomValidity(input.value === "" || isValidAmount(input.value)
                        ? "" : "金額は千円単位・小数点以下3桁までで入力してください。"); }}
                      aria-label={`${accountName} ${month}月の金額`}
                      aria-invalid={value !== "" && !isValidAmount(value)}
                      disabled={readOnly || isSaving || !canEditInitiativeCell(draft, kind, cell)} value={value}
                      onFocus={event => {
                        original.current = value; event.currentTarget.select();
                        setSelection(current => current && (current.anchor.row === index && current.anchor.column === column
                          || current.end.row === index && current.end.column === column) ? current : { anchor: cell, end: cell });
                      }}
                      onBlur={() => setEditing(false)}
                      onDoubleClick={() => { setEditing(true); original.current = value; }}
                      onChange={event => {
                        if (!editing) original.current = value;
                        setEditing(true);
                        changeCell(cell, event.target.value, [...table.current!.querySelectorAll("input")].some(input => input.validity.badInput));
                      }}
                      onCopy={event => {
                        if (editing || !bounds) return;
                        event.preventDefault();
                        event.clipboardData.setData("text/plain", draft.rows.slice(bounds.top, bounds.bottom + 1).map((_, offset) =>
                          months.slice(bounds.left, bounds.right + 1).map((_, columnOffset) => valueAt({ row: bounds.top + offset, column: bounds.left + columnOffset }) || "0").join("\t")
                        ).join("\n"));
                      }}
                      onPaste={event => {
                        event.preventDefault();
                        const text = event.clipboardData.getData("text/plain");
                        apply(() => selection && !/[\t\r\n]/.test(text) ? fillInitiativeGrid(draft, kind, selection, text)
                          : pasteInitiativeGrid(draft, kind, bounds ? { row: bounds.top, column: bounds.left } : cell, text));
                      }}
                      onKeyDown={event => {
                        if (event.nativeEvent.isComposing || isSaving) return;
                        if (!editing && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) event.currentTarget.select();
                        if (event.key === "Escape") {
                          event.preventDefault(); if (editing) changeCell(cell, original.current,
                            [...table.current!.querySelectorAll("input")].some(input => input !== event.currentTarget && input.validity.badInput));
                          setEditing(false); setSelection({ anchor: cell, end: cell }); setError(""); return;
                        }
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && selection) {
                          event.preventDefault();
                          if (event.currentTarget.validity.badInput) { setError("金額に有効な数値を入力してください。"); return; }
                          apply(() => fillInitiativeGrid(draft, kind, selection, value)); return;
                        }
                        if (["Delete", "Backspace"].includes(event.key) && !editing && selection) {
                          event.preventDefault(); apply(() => fillInitiativeGrid(draft, kind, selection, "0")); return;
                        }
                        if (event.key === "F2") { event.preventDefault(); original.current = value; setEditing(true); return; }
                        if (editing && !["Enter", "Tab"].includes(event.key)) return;
                        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(event.key)) return;
                        event.preventDefault();
                        if (editing) {
                          if (event.currentTarget.validity.badInput) { setError("金額に有効な数値を入力してください。"); return; }
                          try { changeCell(cell, normalizeGridAmount(value)); setError(""); }
                          catch (failure) { setError((failure as Error).message); return; }
                        }
                        const from = event.shiftKey && !editing && selection ? selection.end : cell;
                        let row = from.row, col = from.column;
                        const backwards = event.key === "ArrowUp" || event.key === "ArrowLeft" || (event.shiftKey && ["Enter", "Tab"].includes(event.key));
                        const step = backwards ? -1 : 1;
                        if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) row += step;
                        else col += step;
                        if (event.key === "Tab") {
                          if (col > 11) { col = 0; row++; }
                          if (col < 0) { col = 11; row--; }
                        }
                        while (row >= 0 && row < draft.rows.length && col >= 0 && col < 12
                          && !canEditInitiativeCell(draft, kind, { row, column: col })) {
                          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) row += step;
                          else { col += step; if (event.key === "Tab") { if (col > 11) { col = 0; row++; } if (col < 0) { col = 11; row--; } } }
                        }
                        if (canEditInitiativeCell(draft, kind, { row, column: col })) focus({ row, column: col }, event.shiftKey && event.key.startsWith("Arrow"));
                        else { setEditing(false); if (event.key === "Tab") event.currentTarget.blur(); }
                      }}
                    />

                  </td>
                })}
              </tr>;
            })}
          </tbody>
          {totals.rows.length > 0 && <tfoot>{totals.rows.map(row => <tr key={row.attribute}>
            <th scope="row">{accountTypes[row.attribute]}合計</th>
            {months.map(month => <td key={month}>{formatYen(row.amounts[month])}</td>)}
          </tr>)}</tfoot>}
        </table>
  </>;
}
