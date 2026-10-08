import { useRowWindow, WindowRows } from "./VirtualTableRows";
import { detailCount, useDetailWindow } from "./useDetailWindow";
import { detailColumns, detailChoices } from "./detailPresentation";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { canChangeAccountRow } from "../core/domain/kinds";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DetailChange, type DetailField, type DetailRecord } from "../core/domain/details";
import { type Initiative, type PlanContents } from "../core/domain/plan";
import { type TableSort } from "../core/tables/tableSort";
import { tableDisplayValue } from "../core/tables/tableView";
import "./DetailTablePage.css";

export function DetailTablePage({ contents, scroll, onSave, onOpenInitiative, onPendingChange, onPrepareSave }: {
  contents: PlanContents; scroll: { current: { top: number; left: number } };
  onSave: (change: DetailChange) => Promise<void>; onOpenInitiative: (initiative: Initiative) => void; onPendingChange: (pending: boolean) => void; onPrepareSave: () => Promise<void>;
}) {
  const readOnly = useHistoryReadOnly();
  const [sort, setSort] = useState<TableSort | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelNavigation = () => {
    if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    clickTimer.current = null;
  };
  const lock = useRef(false);
  const [editing, setEditing] = useState<{ row: DetailRecord; field: DetailField; columnId: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [focusCell, setFocusCell] = useState<{ rowId: string; columnId: string; index: number } | null>(null);
  const latest = useRef({ editing, contents, onOpenInitiative });
  latest.current = { editing, contents, onOpenInitiative };
  const columns = useMemo(() => detailColumns(contents), [contents]);
  const count = detailCount(contents);
  const rowWindow = useRowWindow(container, count, 34, 2000, 34);
  const detailWindow = useDetailWindow(contents, sort, rowWindow, editing?.row.id ?? focusCell?.rowId);
  useEffect(() => {
    if (!focusCell || editing || detailWindow.loading) return;
    container.current?.querySelector<HTMLElement>(`[data-cell="${focusCell.rowId}-${focusCell.columnId}"]`)?.focus();
  }, [focusCell, editing, detailWindow.items, detailWindow.loading]);
  useEffect(() => { if (container.current) { container.current.scrollTop = scroll.current.top; container.current.scrollLeft = scroll.current.left; } }, [scroll]);
  useEffect(() => { onPendingChange(editing !== null); return () => onPendingChange(false); }, [editing, onPendingChange]);
  useEffect(() => {
    if (!editing) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [editing]);
  useEffect(() => () => cancelNavigation(), []);
  const editableRows = useMemo(() => new Set(contents.initiatives.flatMap(initiative => initiative.rows.filter(row => canChangeAccountRow(row)).map(row => row.id))), [contents.initiatives]);
  const canEdit = (row: DetailRecord, field: DetailField | undefined) => !readOnly && field !== undefined && (row.kindId !== 0 || field === "amount") && (field !== "accountId" || editableRows.has(row.rowId));
  const begin = (row: DetailRecord, field: DetailField, columnId: string) => {
    if (editing || lock.current || !canEdit(row, field)) return;
    cancelNavigation();
    const value = field === "name" ? row.initiativeName : field === "fiscalYear" ? String(row.fiscalYear) : field === "amount" ? row.amount : field === "note" ? row.note : String(row[field] ?? "");
    setSearch(""); setError(""); setEditing({ row, field, columnId, value });
    setFocusCell(null);
  };
  const nextCell = async (row: DetailRecord, columnId: string, direction = 1) => {
    const position = columns.findIndex(column => column.id === columnId);
    for (let index = position + direction; index >= 0 && index < columns.length; index += direction) {
      const column = columns[index]!;
      if (canEdit(row, column.field)) return { rowId: row.id, columnId: column.id, index: detailWindow.items.find(item => item.item.id === row.id)!.index };
    }
    const adjacent = await detailWindow.neighbor(row.id, direction);
    if (!adjacent) return null;
    const column = (direction === 1 ? columns : [...columns].reverse()).find(column => canEdit(adjacent.item, column.field));
    return column ? { rowId: adjacent.item.id, columnId: column.id, index: adjacent.index } : null;
  };
  const commit = async (next = false) => {
    if (!editing || lock.current) return;
    const current = editing;
    lock.current = true; setSaving(true); setError("");
    try {
      const following = next ? await nextCell(current.row, current.columnId) : null;
      await onSave({ target: current.row, field: current.field, value: current.value });
      setEditing(null);
      if (following) setFocusCell(following);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "保存できませんでした。入力内容は残っています。"); }
    finally { lock.current = false; setSaving(false); }
  };
  const choices = detailChoices(contents, editing?.field);
  return <main className="detail-page">
    <div className="detail-toolbar"><h1>明細</h1><span>{count} 行</span><span>金額：千円</span></div>
    {detailWindow.error && <p role="alert">{detailWindow.error}</p>}
    <div ref={container} className="detail-scroll" onPointerDownCapture={cancelNavigation} onKeyDownCapture={cancelNavigation} onScroll={event => { scroll.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; }}>
      <table className={`detail-table${count > 2000 ? " virtual-table" : ""}`} style={{ "--virtual-row-height": "34px" } as React.CSSProperties} aria-rowcount={count + 1} aria-busy={detailWindow.loading}><thead><tr>{columns.map(column => <th key={column.id} scope="col" aria-sort={sort?.column === column.id ? sort.direction : undefined}>
        <button type="button" className="detail-sort-button" disabled={editing !== null || saving} onClick={() => {
          cancelNavigation();
          setFocusCell(null);
          setSort({ column: column.id, direction: sort?.column === column.id && sort.direction === "ascending" ? "descending" : "ascending" });
        }}>{column.label}{sort?.column === column.id && <span className="detail-sort-indicator" aria-hidden="true">{sort.direction === "ascending" ? "▲" : "▼"}</span>}</button>
      </th>)}</tr></thead>
      <tbody><WindowRows items={detailWindow.items} count={count} height={34} columns={columns.length} render={(row, index) => <tr key={row.id} data-detail-id={row.id} aria-rowindex={index + 2}>{columns.map(column => {
        const active = editing?.row.id === row.id && editing.columnId === column.id;
        return <td key={column.id} data-cell={`${row.id}-${column.id}`} tabIndex={canEdit(row, column.field) && !editing ? 0 : -1} className={column.numeric ? "is-number" : undefined}
          onDoubleClick={() => column.field && begin(row, column.field, column.id)} onKeyDown={event => {
            if (!active && !editing && count > 2000 && event.key === "Tab" && canEdit(row, column.field)) {
              const direction = event.shiftKey ? -1 : 1;
              const columnIndex = columns.indexOf(column);
              const remaining = direction === 1 ? columns.slice(columnIndex + 1) : columns.slice(0, columnIndex);
              const boundary = index === (direction === 1 ? count - 1 : 0) && !remaining.some(item => canEdit(row, item.field));
              if (!boundary) {
                event.preventDefault(); void nextCell(row, column.id, direction).then(cell => { if (cell) setFocusCell(cell); }).catch(failure => setError(String(failure)));
              }
            } else if (!active && (event.key === "Enter" || event.key === "F2") && column.field) { event.preventDefault(); begin(row, column.field, column.id); }
          }}>
          {active && editing ? <div className="detail-editor" onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!saving) { setEditing(null); setError(""); } }
            else if (event.key === "Enter") { event.preventDefault(); void commit(); }
            else if (event.key === "Tab") { event.preventDefault(); void commit(true); }
          }}>
            {choices ? <><input autoFocus type="search" aria-label={`${column.label}を検索`} value={search} onChange={event => setSearch(event.target.value)} disabled={saving} /><div className="detail-options">{editing.field === "periodTypeId" && <button type="button" aria-pressed={editing.value === ""} disabled={saving} onClick={() => setEditing({ ...editing, value: "" })}>未選択</button>}{choices.filter(item => item.name.includes(search)).map(item => <button key={item.id} type="button" aria-pressed={editing.value === String(item.id)} disabled={saving} onClick={() => setEditing({ ...editing, value: String(item.id) })}>{item.name}</button>)}</div></>
              : <input autoFocus aria-label={`${column.label}を編集`} value={editing.value} disabled={saving} inputMode={editing.field === "amount" ? "decimal" : editing.field === "fiscalYear" ? "numeric" : undefined} onChange={event => setEditing({ ...editing, value: event.target.value })} />}
            <div><button type="button" disabled={saving} onClick={() => void commit()}>{saving ? "保存中" : "確定"}</button><button type="button" disabled={saving} onClick={() => { setEditing(null); setError(""); }}>取消</button></div>
            {error && <><p role="alert">{error}</p><button type="button" disabled={saving} onClick={() => { void onPrepareSave().then(() => commit()).catch(failure => setError(failure instanceof Error ? failure.message : "保存先を選択できませんでした。")); }}>保存を再試行</button></>}
          </div> : column.id === "initiativeName" ? <button type="button" className="detail-initiative-link" disabled={editing !== null || row.kindId === 0} onClick={event => {
            cancelNavigation();
            if (event.detail > 1) return;
            clickTimer.current = setTimeout(() => {
              clickTimer.current = null;
              if (latest.current.editing || lock.current || !container.current?.isConnected) return;
              const initiative = latest.current.contents.initiatives.find(item => item.id === row.initiativeId);
              if (initiative) latest.current.onOpenInitiative(initiative);
            }, 650);
          }}>{row.initiativeName}</button> : tableDisplayValue(column, row)}
        </td>;
      })}</tr>} /></tbody></table>
      {!count && <p className="detail-empty">表示する明細がありません。</p>}
    </div>
  </main>;
}
