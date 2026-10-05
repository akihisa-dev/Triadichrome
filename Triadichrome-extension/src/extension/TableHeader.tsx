import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tableDisplayValue, type TableColumn, type TableView } from "../core/tableView";
import "./TableHeader.css";

export function TableHeader<T>({ column, rows, view, onChange, disabled = false }: { column: TableColumn<T>; rows: T[]; view: TableView; onChange: (view: TableView) => void; disabled?: boolean }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [search, setSearch] = useState("");
  const selected = view.filters[column.id];
  const values = [...new Set(rows.map(row => tableDisplayValue(column, row)))].sort(new Intl.Collator("ja", { numeric: true }).compare);
  const filtered = values.filter(value => value.includes(search));
  const sort = view.sort?.column === column.id ? view.sort.direction : null;
  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setPosition(null); trigger.current?.focus(); } };
    const reposition = () => setPosition(null);
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key, true);
    window.addEventListener("resize", reposition);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key, true); window.removeEventListener("resize", reposition); };
  }, [position]);
  function choose(next: string[] | undefined) {
    const filters = { ...view.filters };
    if (next === undefined || next.length === values.length) delete filters[column.id]; else filters[column.id] = next;
    onChange({ ...view, filters });
  }
  return <div className="table-column-controls">
    <button type="button" className="table-sort-button" disabled={disabled} aria-label={`${column.label}で${sort === "asc" ? "降順" : "昇順"}に並べ替え`} onClick={() => onChange({ ...view, sort: { column: column.id, direction: sort === "asc" ? "desc" : "asc" } })}>{column.label}<span aria-hidden="true">{sort === "asc" ? " ↑" : sort === "desc" ? " ↓" : ""}</span></button>
    <button type="button" ref={trigger} className={`table-filter-button${selected ? " is-active" : ""}`} disabled={disabled} aria-label={`${column.label}のフィルター`} aria-expanded={position !== null} onClick={() => {
      if (position) { setPosition(null); return; }
      const rect = trigger.current!.getBoundingClientRect(); setSearch(""); setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 320)) });
    }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg></button>
    {position && createPortal(<div ref={panel} className="table-filter-panel" style={position} role="dialog" aria-label={`${column.label}のフィルター`}>
      <input autoFocus type="search" aria-label={`${column.label}の値を検索`} placeholder="検索" value={search} onChange={event => setSearch(event.target.value)} />
      <label><input type="checkbox" checked={selected === undefined} onChange={event => choose(event.target.checked ? undefined : [])} />すべて</label>
      <div className="table-filter-values">{filtered.map(value => <label key={value}><input type="checkbox" checked={selected === undefined || selected.includes(value)} onChange={event => {
        const current = selected ?? values;
        choose(event.target.checked ? [...current, value] : current.filter(item => item !== value));
      }} />{value === "" ? "空欄" : value}</label>)}</div>
      <button type="button" className="text-button" onClick={() => { setPosition(null); trigger.current?.focus(); }}>閉じる</button>
    </div>, document.body)}
  </div>;
}
