import { PlanEditor, formatAmount } from "./PlanEditor";
import { useState, type DragEvent } from "react";
import type { QueryExecResult } from "sql.js";
import type { BudgetData, BudgetEdit, ItemKind, NamedItem } from "../core/budgetData";

type Props = {
  data: BudgetData;
  section: "detail" | "cost" | "expansion" | "initiative";
  disabled: boolean;
  draftActive: boolean;
  onDraftChange: (dirty: boolean) => void;
  onEdit: (edit: BudgetEdit) => Promise<boolean>;
};

const titles = { detail: "明細", cost: "総原価表", expansion: "展開表", initiative: "施策入力" };
const columns: Record<string, string> = {
  year: "年", month: "月", initiative_name: "施策", account_name: "勘定科目",
  budget_amount: "原価（円）", budget_sales_amount: "売上（円）",
  budget_profit_amount: "利益（円）", note: "メモ",
};

function NamedList({ kind, items, disabled, onEdit }: {
  kind: ItemKind; items: NamedItem[]; disabled: boolean; onEdit: Props["onEdit"];
}) {
  const [name, setName] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [target, setTarget] = useState<{ id: number; after: boolean } | null>(null);
  const label = kind === "initiative" ? "施策" : "勘定科目";
  const move = (id: number, targetId: number, after: boolean) => {
    if (id !== targetId) void onEdit({ type: "move", kind, id, targetId, after });
    setDragId(null);
    setTarget(null);
  };
  const over = (event: DragEvent, id: number) => {
    if (dragId === null || disabled || id === dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setTarget({ id, after: event.clientY > bounds.top + bounds.height / 2 });
  };
  return <section className="budget-list" aria-label={`${label}の登録と並べ替え`}>
    <h2>{label}</h2>
    <form className="budget-add" onSubmit={(event) => {
      event.preventDefault();
      void onEdit({ type: "add", kind, name }).then((done) => { if (done) setName(""); });
    }}>
      <input aria-label={`新しい${label}名`} placeholder={`${label}名を入力`} value={name}
        disabled={disabled} onChange={(event) => setName(event.target.value)} required />
      <button disabled={disabled || !name.trim()}>追加</button>
    </form>
    <ul>
      {items.map((item, index) => <li key={item.id}
        className={target?.id === item.id ? (target.after ? "drop-after" : "drop-before") : ""}
        onDragOver={(event) => over(event, item.id)}
        onDrop={(event) => {
          if (dragId === null || disabled) return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          move(dragId, item.id, event.clientY > bounds.top + bounds.height / 2);
        }}>
        <button type="button" className="drag-handle" draggable={!disabled}
          disabled={disabled} aria-label={`${item.name}をドラッグして並べ替え。上下の矢印キーでも移動できます`}
          onDragStart={(event) => {
            setDragId(item.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(`application/x-triadic-${kind}`, String(item.id));
          }}
          onDragEnd={() => { setDragId(null); setTarget(null); }}
          onKeyDown={(event) => {
            const next = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
            const sibling = items[next];
            if (sibling) { event.preventDefault(); move(item.id, sibling.id, next > index); }
          }}>⠿</button>
        <input key={`${item.id}:${item.name}`} aria-label={`${label}名 ${item.name}`} defaultValue={item.name}
          disabled={disabled} onBlur={(event) => {
            const input = event.currentTarget;
            if (input.value.trim() !== item.name) {
              void onEdit({ type: "rename", kind, id: item.id, name: input.value })
                .then((done) => { if (!done) input.value = item.name; });
            }
          }} onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") { event.currentTarget.value = item.name; event.currentTarget.blur(); }
          }} />
        <button type="button" disabled={disabled} aria-label={`${item.name}を削除`} onClick={() => {
          if (window.confirm(`「${item.name}」を削除しますか？ 明細で使用中の項目は削除できません。`)) void onEdit({ type: "removeItem", kind, id: item.id });
        }}>削除</button>
      </li>)}
    </ul>
  </section>;
}

function DataTable({ data }: { data: QueryExecResult }) {
  if (data.values.length === 0) return <p className="budget-empty">0件</p>;
  return <div className="budget-table-scroll" tabIndex={0} aria-label="表を横にスクロールできます">
    <table className="budget-table"><thead><tr>{data.columns.map((column) =>
      <th key={column} scope="col">{columns[column] ?? column}</th>)}</tr></thead>
      <tbody>{data.values.map((row, index) => <tr key={index}>
        {row.map((value, cell) => <td key={cell} className={typeof value === "number" ? "numeric" : ""}>
          {typeof value === "number" ? (cell < 2 ? value : formatAmount(value)) : String(value ?? "")}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function BudgetWorkspace({ data, section, disabled, onEdit, onDraftChange, draftActive }: Props) {
  const year = new Date().getFullYear();
  const [start, setStart] = useState(data.months[0] ?? `${year}-01`);
  const [end, setEnd] = useState(data.months.at(-1) ?? `${year}-12`);
  return <section className="budget-workspace" aria-labelledby="budget-section-title">
    <div className="workspace-heading">
      <h1 id="budget-section-title">{titles[section]}</h1>
      {section === "initiative" ? <form className="period-form" onSubmit={(event) => {
        event.preventDefault();
        void onEdit({ type: "period", start, end });
      }}>
        <label>期間<input type="month" min="0001-01" max="9999-12" aria-label="開始月" value={start} onChange={(event) => setStart(event.target.value)} required disabled={disabled || draftActive} /></label>
        <span>—</span>
        <input type="month" min={start || "0001-01"} max="9999-12" aria-label="終了月" value={end} onChange={(event) => setEnd(event.target.value)} required disabled={disabled || draftActive} />
        <button disabled={disabled || draftActive || !start || !end || start > end}>期間を設定</button>
      </form> : null}
    </div>
    {section === "initiative" ? <>
      <PlanEditor data={data} disabled={disabled} onEdit={onEdit} onDraftChange={onDraftChange} />
      <details className="sheet-settings"><summary>名称・並び順を編集</summary>
        <fieldset disabled={disabled || draftActive}>
          <div className="budget-lists">
            <NamedList kind="initiative" items={data.initiatives} disabled={disabled || draftActive} onEdit={onEdit} />
            <NamedList kind="account" items={data.accounts} disabled={disabled || draftActive} onEdit={onEdit} />
          </div>
        </fieldset>
      </details>
    </> : <>
      <div className="plan-summary" aria-label="計画全体の合計">
        <span>原価 <strong>{formatAmount(data.lines.reduce((sum, line) => sum + line.cost, 0))}</strong></span>
        <span>売上 <strong>{formatAmount(data.lines.reduce((sum, line) => sum + line.sales, 0))}</strong></span>
        <span>利益 <strong>{formatAmount(data.lines.reduce((sum, line) => sum + line.sales - line.cost, 0))}</strong> 円</span>
      </div>
      <DataTable data={data[section]} />
    </>}
  </section>;
}
