import { useEffect, useRef, useState } from "react";
import { previousByAccount } from "../core/planTables";
import { buildCostTable } from "../core/costTable";
import { formatAmount, formatRate, isValidAmount } from "../core/amounts";
import { initiativeMonths, type PlanContents } from "../core/initiatives";
import type { PreviousInput } from "../core/kindAmounts";
import { fillPreviousGrid, gridBounds, normalizeGridAmount, pastePreviousGrid, type GridCell, type GridSelection } from "../core/previousGrid";
import { StatusNotice } from "./StatusNotice";

export function PreviousAmountGrid({ contents, draft, onChange }: {
  contents: PlanContents; draft: PreviousInput | undefined; onChange: (draft: PreviousInput) => void;
}) {
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef(false);
  const table = useRef<HTMLTableElement>(null);
  const original = useRef("");
  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);
  const invalid = draft?.rows.some(row => Object.values(row.amounts).some(value => value !== undefined && value !== "" && !isValidAmount(value))) ?? false;
  const previous = draft ? new Map(draft.rows.map(row => [row.accountId, Object.fromEntries(initiativeMonths.map(month => [month,
    isValidAmount(row.amounts[month] ?? "0") ? Number(row.amounts[month] ?? "0") : 0]))])) : previousByAccount(contents);
  let rows;
  let calculationFailed = invalid;
  try { rows = buildCostTable(contents.accounts, contents.aggregations, [], contents.fiscalYear, previous); }
  catch { rows = buildCostTable(contents.accounts, contents.aggregations, [], contents.fiscalYear); calculationFailed = true; }
  const rowIds = rows.map(row => row.kind === "account" ? row.id : null);
  const bounds = selection ? gridBounds(selection) : null;
  const focus = (cell: GridCell, extend = false) => {
    setSelection(current => ({ anchor: extend && current ? current.anchor : cell, end: cell }));
    setEditing(false);
    table.current?.querySelector<HTMLInputElement>(`input[data-row="${cell.row}"][data-column="${cell.column}"]`)?.focus();
  };
  const apply = (operation: () => PreviousInput) => {
    try { onChange(operation()); setError(""); setEditing(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "入力できませんでした。"); }
  };
  const changeCell = (accountId: number, month: number, value: string) => draft && onChange({ ...draft,
    rows: draft.rows.map(row => row.accountId === accountId ? { ...row, amounts: { ...row.amounts, [month]: value } } : row) });
  return <>
    <StatusNotice message={error} error onDismiss={() => setError("")} />
    <div className="previous-grid-container" role="region" aria-label="前年の月別金額" tabIndex={0}>
      <table ref={table} className="initiative-list-table cost-table previous-grid" aria-label="前年入力の月別金額">
        <thead><tr><th scope="col" className="initiative-list-name">科目・集計</th>{initiativeMonths.map(month => <th scope="col" key={month}>{month}月</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={`${row.kind}:${row.id}`} className={row.kind !== "account" ? `cost-subtotal${row.required ? " cost-required" : ""}` : undefined}>
          <th scope="row" className="initiative-list-name">{row.name}</th>
          {initiativeMonths.map((month, column) => {
            const cell = { row: rowIndex, column };
            const selected = bounds && rowIndex >= bounds.top && rowIndex <= bounds.bottom && column >= bounds.left && column <= bounds.right;
            const value = draft?.rows.find(input => input.accountId === row.id)?.amounts[month] ?? "0";
            return <td key={month} className={`${row.kind === "account" && draft ? "previous-input-cell" : ""}${selected ? " previous-cell-selected" : ""}`}
              onPointerEnter={() => { if (dragging.current) setSelection(current => current ? { ...current, end: cell } : null); }}>
              {row.kind !== "account" || !draft ? (calculationFailed ? "" : row.kind === "ratio" ? formatRate(row.previous[month]) : formatAmount(row.previous[month])) :
                <input type="text" inputMode="decimal" data-row={rowIndex} data-column={column}
                  aria-label={`${row.name} ${month}月の前年金額`} aria-invalid={value !== undefined && value !== "" && !isValidAmount(value)} value={value}
                  onFocus={event => { original.current = value; event.currentTarget.select(); setSelection(current => current && (current.anchor.row === rowIndex && current.anchor.column === column || current.end.row === rowIndex && current.end.column === column) ? current : { anchor: cell, end: cell }); }}
                  onBlur={() => setEditing(false)}
                  onPointerDown={event => {
                    if (event.button !== 0 || (editing && selection?.end.row === rowIndex && selection.end.column === column && !event.shiftKey)) return;
                    event.preventDefault(); dragging.current = true; focus(cell, event.shiftKey);
                  }}
                  onDoubleClick={() => { setEditing(true); original.current = value; }}
                  onChange={event => { if (!editing) original.current = value; setEditing(true); changeCell(row.id, month, event.target.value); }}
                  onCopy={event => {
                    if (editing || !bounds) return;
                    event.preventDefault();
                    event.clipboardData.setData("text/plain", rows.slice(bounds.top, bounds.bottom + 1).map(item => initiativeMonths.slice(bounds.left, bounds.right + 1).map(m =>
                      item.kind === "account" ? draft.rows.find(input => input.accountId === item.id)?.amounts[m] || "0" : calculationFailed ? "" : item.kind === "ratio" ? formatRate(item.previous[m]) : String(item.previous[m] ?? "")
                    ).join("\t")).join("\n"));
                  }}
                  onPaste={event => {
                    event.preventDefault();
                    const start = bounds ? { row: bounds.top, column: bounds.left } : cell;
                    const text = event.clipboardData.getData("text/plain");
                    apply(() => selection && !/[\t\r\n]/.test(text) ? fillPreviousGrid(draft, rowIds, selection, text) : pastePreviousGrid(draft, rowIds, start, text));
                  }}
                  onKeyDown={event => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Escape") { event.preventDefault(); if (editing) changeCell(row.id, month, original.current); setEditing(false); setSelection({ anchor: cell, end: cell }); return; }
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && selection) { event.preventDefault(); apply(() => fillPreviousGrid(draft, rowIds, selection, value)); return; }
                    if ((event.key === "Delete" || event.key === "Backspace") && !editing && selection) { event.preventDefault(); apply(() => fillPreviousGrid(draft, rowIds, selection, "0")); return; }
                    if (event.key === "F2") { event.preventDefault(); original.current = value; setEditing(true); return; }
                    if (editing && event.key !== "Enter" && event.key !== "Tab") return;
                    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(event.key)) return;
                    event.preventDefault();
                    if (editing) { try { changeCell(row.id, month, normalizeGridAmount(value)); } catch (failure) { setError((failure as Error).message); return; } }
                    const from = event.shiftKey && !editing && selection ? selection.end : cell;
                    let nextRow = from.row, nextColumn = from.column;
                    if (event.key === "ArrowLeft") nextColumn--;
                    if (event.key === "ArrowRight") nextColumn++;
                    if (event.key === "Tab") { nextColumn += event.shiftKey ? -1 : 1; if (nextColumn > 11) { nextColumn = 0; nextRow++; } if (nextColumn < 0) { nextColumn = 11; nextRow--; } }
                    const vertical = event.key === "ArrowUp" || (["Enter", "Tab"].includes(event.key) && event.shiftKey) ? -1 : 1;
                    if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) nextRow += vertical;
                    while (nextRow >= 0 && nextRow < rows.length && rowIds[nextRow] === null) nextRow += vertical;
                    if (nextRow >= 0 && nextRow < rows.length && nextColumn >= 0 && nextColumn < 12) focus({ row: nextRow, column: nextColumn }, event.shiftKey && event.key.startsWith("Arrow"));
                    else if (event.key === "Tab") { event.currentTarget.blur(); setEditing(false); }
                    else setEditing(false);
                  }} />}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
