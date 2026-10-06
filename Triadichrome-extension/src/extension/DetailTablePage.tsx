import { useHistoryReadOnly } from "./HistoryReadOnly";
import { canChangeAccountRow } from "../core/kindAmounts";
import { accountTypes, isAccountType } from "../core/accountTypes";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DetailChange, type DetailField, type DetailRecord } from "../core/details";
import { type Initiative, type PlanContents } from "../core/initiatives";
import { type TableColumn, tableDisplayValue } from "../core/tableView";
import "./DetailTablePage.css";

type Column = TableColumn<DetailRecord> & { field?: DetailField };
export function DetailTablePage({ contents, scroll, onSave, onOpenInitiative, onPendingChange, onPrepareSave }: {
  contents: PlanContents; scroll: { current: { top: number; left: number } };
  onSave: (change: DetailChange) => Promise<void>; onOpenInitiative: (initiative: Initiative) => void; onPendingChange: (pending: boolean) => void; onPrepareSave: () => Promise<void>;
}) {
  const readOnly = useHistoryReadOnly();
  const rows = contents.details ?? [];
  const container = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);
  const [editing, setEditing] = useState<{ row: DetailRecord; field: DetailField; columnId: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const name = (list: { id: number; name: string }[], id: number | null) => list.find(item => item.id === id)?.name ?? null;
  const columns: Column[] = useMemo(() => [
    { id: "fiscalYear", label: "年度", numeric: true, value: row => row.fiscalYear },
    { id: "kind", label: "種別", value: row => row.kindName },
    { id: "industry", label: "業種名", field: "industryId", value: row => name(contents.industries.map(item => ({ id: item.id, name: item.industryName })), row.industryId) },
    { id: "initiativeName", label: "施策名", field: "name", value: row => row.initiativeName },
    { id: "expansion", label: "展開名", field: "expansionId", value: row => name(contents.expansions.map(item => ({ id: item.id, name: item.expansionName })), row.expansionId) },
    { id: "department", label: "部署名", field: "departmentId", value: row => name(contents.departments.map(item => ({ id: item.id, name: item.departmentName })), row.departmentId) },
    { id: "period", label: "期間名", field: "periodTypeId", value: row => name(contents.periodTypes.map(item => ({ id: item.id, name: item.periodName })), row.periodTypeId) },
    { id: "accountCode", label: "科目コード", field: "accountId", value: row => row.accountCode },
    { id: "account", label: "科目名", field: "accountId", value: row => row.accountName },
    { id: "attribute", label: "科目属性", value: row => isAccountType(row.accountType) ? accountTypes[row.accountType] : null },
    { id: "month", label: "年月", value: row => `${row.year}-${String(row.month).padStart(2, "0")}` },
    { id: "amount", label: "金額", field: "amount", numeric: true, amount: true, value: row => row.amount },
    { id: "sales", label: "売上", numeric: true, amount: true, value: row => row.sales },
    { id: "expense", label: "費用", numeric: true, amount: true, value: row => row.accountType === "expense" ? row.amount : "0" },
    { id: "profit", label: "利益", numeric: true, amount: true, value: row => row.profit },
    { id: "note", label: "施策備考", field: "note", value: row => row.note },
  ], [contents.expansions, contents.departments, contents.periodTypes, contents.industries]);
  useEffect(() => { if (container.current) { container.current.scrollTop = scroll.current.top; container.current.scrollLeft = scroll.current.left; } }, [scroll]);
  useEffect(() => { onPendingChange(editing !== null); return () => onPendingChange(false); }, [editing, onPendingChange]);
  useEffect(() => {
    if (!editing) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [editing]);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);
  const editableRows = new Set(contents.initiatives.flatMap(initiative => initiative.rows.filter(row => canChangeAccountRow(row, contents.revisedActive)).map(row => row.id)));
  const canEdit = (row: DetailRecord, field: DetailField | undefined) => !readOnly && field !== undefined && (row.kindId !== 0 || field === "amount") && !(row.kindId === 3 && row.month >= 4 && row.month <= 9 && field === "amount") && (field !== "accountId" || editableRows.has(row.rowId));
  const begin = (row: DetailRecord, field: DetailField, columnId: string) => {
    if (editing || lock.current || contents.migrationError || !canEdit(row, field)) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    const value = field === "name" ? row.initiativeName : field === "fiscalYear" ? String(row.fiscalYear) : field === "amount" ? row.amount : field === "note" ? row.note : String(row[field] ?? "");
    setSearch(""); setError(""); setEditing({ row, field, columnId, value });
  };
  const commit = async (next = false) => {
    if (!editing || lock.current) return;
    const current = editing;
    lock.current = true; setSaving(true); setError("");
    try {
      await onSave({ target: current.row, field: current.field, value: current.value });
      setEditing(null);
      if (next) {
        const cells = rows.flatMap(row => columns.filter(column => canEdit(row, column.field)).map(column => ({ row, column })));
        const position = cells.findIndex(cell => cell.row.id === current.row.id && cell.column.id === current.columnId);
        const nextCell = cells[position + 1];
        if (nextCell) requestAnimationFrame(() => container.current?.querySelector<HTMLElement>(`[data-cell="${nextCell.row.id}-${nextCell.column.id}"]`)?.focus());
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "保存できませんでした。入力内容は残っています。"); }
    finally { lock.current = false; setSaving(false); }
  };
  const choices = editing?.field === "accountId" ? contents.accounts.filter(item => item.accountType).map(item => ({ id: item.id, name: `${item.accountCode ?? "未設定"} ${item.accountName}` }))
    : editing?.field === "industryId" ? contents.industries.map(item => ({ id: item.id, name: item.industryName })) : editing?.field === "expansionId" ? contents.expansions.map(item => ({ id: item.id, name: item.expansionName })) : editing?.field === "departmentId" ? contents.departments.map(item => ({ id: item.id, name: item.departmentName })) : editing?.field === "periodTypeId" ? contents.periodTypes.map(item => ({ id: item.id, name: item.periodName })) : null;
  return <main className="detail-page">
    <div className="detail-toolbar"><h1>明細</h1><span>{rows.length} 行</span><span>金額：千円</span></div>
    <p className="detail-help">{readOnly ? "施策名を押すと、その時点の施策を確認できます。" : "セルをダブルクリックして編集します。施策名のクリックで施策画面を開きます。"}</p>
    {contents.migrationError && <p role="alert">{contents.migrationError}</p>}
    <div ref={container} className="detail-scroll" onScroll={event => { scroll.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; }}>
      <table className="detail-table"><thead><tr>{columns.map(column => <th key={column.id} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} data-detail-id={row.id}>{columns.map(column => {
        const active = editing?.row.id === row.id && editing.columnId === column.id;
        return <td key={column.id} data-cell={`${row.id}-${column.id}`} tabIndex={canEdit(row, column.field) && !editing ? 0 : -1} className={column.numeric ? "is-number" : undefined}
          onDoubleClick={() => column.field && begin(row, column.field, column.id)} onKeyDown={event => { if (!active && (event.key === "Enter" || event.key === "F2") && column.field) { event.preventDefault(); begin(row, column.field, column.id); } }}>
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
          </div> : column.id === "initiativeName" ? <button type="button" className="detail-initiative-link" disabled={editing !== null || row.kindId === 0} onClick={event => { if (event.detail > 1) return; clickTimer.current = setTimeout(() => { const initiative = contents.initiatives.find(item => item.id === row.initiativeId); if (initiative) onOpenInitiative(initiative); }, 650); }}>{row.initiativeName}</button> : tableDisplayValue(column, row)}
        </td>;
      })}</tr>)}</tbody></table>
      {!rows.length && <p className="detail-empty">表示する明細がありません。</p>}
    </div>
  </main>;
}
