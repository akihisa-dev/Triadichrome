import { useEffect, useMemo, useState } from "react";
import type { BudgetData, BudgetEdit } from "../core/budgetData";

export const formatAmount = (value: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
type Props = {
  data: BudgetData;
  disabled: boolean;
  onEdit: (edit: BudgetEdit) => Promise<boolean>;
  onDraftChange: (dirty: boolean) => void;
};
type Field = "cost" | "sales" | "profit" | "note";
type Cell = { initiativeId: number; accountId: number; month: string; cost: string; sales: string; note: string; id?: number };
const fields: Record<Field, string> = { cost: "原価", sales: "売上", profit: "利益", note: "メモ" };
const cellKey = (initiativeId: number, accountId: number, month: string) => `${initiativeId}:${accountId}:${month}`;

export function PlanEditor({ data, disabled, onEdit, onDraftChange }: Props) {
  const [selectedId, setSelectedId] = useState(data.initiatives[0]?.id ?? 0);
  const initiativeId = data.initiatives.some((item) => item.id === selectedId) ? selectedId : (selectedId === -1 ? data.initiatives.at(-1)?.id ?? 0 : data.initiatives[0]?.id ?? 0);
  useEffect(() => {
    if (selectedId === -1 && data.initiatives.length) setSelectedId(data.initiatives.at(-1)!.id);
  }, [data.initiatives, selectedId]);
  const [field, setField] = useState<Field>("cost");
  const [drafts, setDrafts] = useState<Record<string, Cell>>({});
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const existing = useMemo(() => new Map(data.lines.map((line) => [cellKey(line.initiativeId, line.accountId, line.month), line])), [data.lines]);
  const dirty = Object.keys(drafts).length > 0;
  const active = activeKey ? existing.get(activeKey) : undefined;
  const initiative = data.initiatives.find((item) => item.id === initiativeId);
  const read = (accountId: number, month: string): Cell => {
    const key = cellKey(initiativeId, accountId, month);
    if (drafts[key]) return drafts[key];
    const line = existing.get(key);
    return { initiativeId, accountId, month, cost: line ? String(line.cost) : "", sales: line ? String(line.sales) : "", note: line?.note ?? "", ...(line ? { id: line.id } : {}) };
  };
  const change = (cell: Cell, value: string) => {
    if (field === "profit") return;
    const key = cellKey(cell.initiativeId, cell.accountId, cell.month);
    const nextCell = { ...cell, [field]: value };
    const original = existing.get(key);
    const next = { ...drafts, [key]: nextCell };
    if (nextCell.cost === (original ? String(original.cost) : "") && nextCell.sales === (original ? String(original.sales) : "") && nextCell.note === (original?.note ?? "")) delete next[key];
    setDrafts(next);
    setError("");
    onDraftChange(Object.keys(next).length > 0);
  };
  const amount = (cell: Cell) => field === "sales" ? Number(cell.sales) : field === "profit" ? Number(cell.sales) - Number(cell.cost) : Number(cell.cost);
  const total = (cells: Cell[]) => {
    const sum = cells.reduce((value, cell) => value + amount(cell), 0);
    return Number.isFinite(sum) ? formatAmount(sum) : "—";
  };
  const save = async () => {
    setError("");
    const edits = Object.values(drafts).map((cell) => ({
      ...(cell.id === undefined ? {} : { id: cell.id }),
      line: { initiativeId: cell.initiativeId, accountId: cell.accountId, month: cell.month, cost: Number(cell.cost), sales: Number(cell.sales), note: cell.note },
    }));
    if (edits.some(({ line }) => [line.cost, line.sales, line.sales - line.cost].some((value) => !Number.isFinite(value) || Math.abs(value) > 1e12) || [line.cost, line.sales].some((value) => Number(value.toFixed(2)) !== value))) {
      setError("金額は小数第2位まで、原価・売上・利益は絶対値1兆以下で入力してください。");
      return;
    }
    if (await onEdit({ type: "plans", edits })) {
      setDrafts({});
      onDraftChange(false);
    }
  };
  return <section className="initiative-sheet" aria-label="施策の月別計画">
    <div className="sheet-heading">
      {data.initiatives.length ? <label className="initiative-select">施策
        <select aria-label="入力する施策" value={initiativeId} disabled={disabled} onChange={(event) => { setSelectedId(Number(event.target.value)); setActiveKey(null); }}>
          {data.initiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label> : null}
      <form className="inline-add" onSubmit={(event) => {
        event.preventDefault();
        void onEdit({ type: "add", kind: "initiative", name }).then((done) => { if (done) { setName(""); setSelectedId(-1); } });
      }}>
        <input aria-label="新しい施策名" placeholder="新しい施策名" value={name} disabled={disabled || dirty} onChange={(event) => setName(event.target.value)} required />
        <button disabled={disabled || dirty || !name.trim()}>施策を追加</button>
      </form>
    </div>
    <div className="sheet-toolbar">
      <div className="sheet-fields" aria-label="表示する項目">{(Object.keys(fields) as Field[]).map((value) =>
        <button key={value} type="button" aria-pressed={field === value} onClick={() => setField(value)}>{fields[value]}</button>)}</div>
      <span className="sheet-unit">{field === "note" ? "" : "円"}</span>
      {dirty ? <div className="sheet-save"><span>未確定 {Object.keys(drafts).length}セル</span>
        <button type="button" disabled={disabled} onClick={() => { if (window.confirm("表の入力を取り消しますか？")) { setDrafts({}); onDraftChange(false); setError(""); } }}>取り消す</button>
        <button type="button" className="primary-button" disabled={disabled} onClick={() => void save()}>{disabled ? "保存中…" : "変更を保存"}</button>
      </div> : null}
    </div>
    {error ? <p role="alert" className="save-notice">{error}</p> : null}
    {initiativeId && data.months.length ?
      <div className="sheet-scroll" tabIndex={0} aria-label={`${initiative?.name}の月別${fields[field]}表`}>
        <table className={`month-sheet${field === "note" ? " note-sheet" : ""}`}>
          <caption className="sr-only">{initiative?.name}：勘定科目別・月別の{fields[field]}</caption>
          <thead><tr><th scope="col">勘定科目</th>{data.months.map((month) => <th scope="col" key={month}>{month.replace("-", "/")}</th>)}{field !== "note" ? <th scope="col">合計</th> : null}</tr></thead>
          <tbody>{data.accounts.map((item) => <tr key={item.id}>
            <th scope="row">{item.name}</th>
            {data.months.map((month) => {
              const cell = read(item.id, month);
              const key = cellKey(initiativeId, item.id, month);
              return <td key={month} className={drafts[key] ? "is-edited" : ""}>
                {field === "profit" ? <output>{formatAmount(Number(cell.sales) - Number(cell.cost))}</output> :
                  <input type="text" inputMode={field === "note" ? "text" : "decimal"} aria-label={`${initiative?.name} ${item.name} ${month} ${fields[field]}`}
                    value={cell[field]} disabled={disabled} placeholder={field === "note" ? "" : "—"}
                    onFocus={() => setActiveKey(key)} onChange={(event) => change(cell, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (event.ctrlKey || event.metaKey) { if (dirty) void save(); return; }
                        const inputs = Array.from(event.currentTarget.closest("table")!.querySelectorAll<HTMLInputElement>("td input"));
                        const index = inputs.indexOf(event.currentTarget);
                        inputs[index + (event.shiftKey ? -data.months.length : data.months.length)]?.focus();
                      }
                    }} />}
              </td>;
            })}
            {field !== "note" ? <td className="sheet-total">{total(data.months.map((month) => read(item.id, month)))}</td> : null}
          </tr>)}</tbody>
          {field !== "note" ? <tfoot><tr><th scope="row">合計</th>{data.months.map((month) => <td key={month}>{total(data.accounts.map((item) => read(item.id, month)))}</td>)}
            <td>{total(data.accounts.flatMap((item) => data.months.map((month) => read(item.id, month))))}</td>
          </tr></tfoot> : null}
        </table>
      </div> : null}
    <div className="sheet-footer">
      <form className="inline-add" onSubmit={(event) => {
        event.preventDefault();
        void onEdit({ type: "add", kind: "account", name: account }).then((done) => { if (done) setAccount(""); });
      }}>
        <input aria-label="新しい勘定科目名" placeholder="勘定科目名" value={account} disabled={disabled || dirty} onChange={(event) => setAccount(event.target.value)} required />
        <button disabled={disabled || dirty || !account.trim()}>行を追加</button>
      </form>
      {active && !dirty ? <button type="button" className="cell-delete" disabled={disabled} onClick={() => {
        if (window.confirm(`${data.accounts.find((item) => item.id === active.accountId)?.name}・${active.month}の原価・売上・メモを削除しますか？`)) void onEdit({ type: "deletePlan", id: active.id }).then((done) => { if (done) setActiveKey(null); });
      }}>選択セルの記録を削除</button> : null}
    </div>
  </section>;
}
