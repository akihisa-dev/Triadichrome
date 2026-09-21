import { useState, type DragEvent } from "react";
import type { QueryExecResult } from "sql.js";
import type { BudgetData, BudgetEdit, ItemKind, NamedItem } from "../core/budgetData";

type Props = {
  data: BudgetData;
  section: "detail" | "cost" | "expansion" | "initiative";
  disabled: boolean;
  onEdit: (edit: BudgetEdit) => Promise<boolean>;
};

const titles = { detail: "明細", cost: "総原価表", expansion: "展開表", initiative: "施策入力" };
const columns: Record<string, string> = {
  year: "年", month: "月", initiative_name: "施策", account_name: "勘定科目",
  budget_amount: "予算額", actual_amount: "実績額", budget_sales_amount: "売上・予算",
  actual_sales_amount: "売上・実績", budget_profit_amount: "利益・予算",
  actual_profit_amount: "利益・実績", note: "メモ",
};
const numberFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 20 });

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
      </li>)}
    </ul>
    {items.length === 0 ? <p className="budget-empty">{label}を追加すると、ここに並びます。</p> : null}
  </section>;
}

function DataTable({ data }: { data: QueryExecResult }) {
  if (data.values.length === 0) return <p className="budget-empty">登録されている明細はありません。</p>;
  return <div className="budget-table-scroll" tabIndex={0} aria-label="表を横にスクロールできます">
    <table className="budget-table"><thead><tr>{data.columns.map((column) =>
      <th key={column} scope="col">{columns[column] ?? column}</th>)}</tr></thead>
      <tbody>{data.values.map((row, index) => <tr key={index}>
        {row.map((value, cell) => <td key={cell} className={typeof value === "number" ? "numeric" : ""}>
          {typeof value === "number" ? (cell < 2 ? value : numberFormat.format(value)) : String(value ?? "")}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function BudgetWorkspace({ data, section, disabled, onEdit }: Props) {
  const [month, setMonth] = useState("");
  return <section className="budget-workspace" aria-labelledby="budget-section-title">
    <h1 id="budget-section-title">{titles[section]}</h1>
    {section === "initiative" ? <>
      <p className="budget-hint">名前を直接編集できます。左の取っ手をドラッグすると並び順が変わります。</p>
      <label className="budget-name">予算名
        <input key={data.name} defaultValue={data.name} placeholder="予算名を入力" disabled={disabled}
          onBlur={(event) => {
            const input = event.currentTarget;
            if (input.value.trim() !== data.name) {
              void onEdit({ type: "name", name: input.value })
                .then((done) => { if (!done) input.value = data.name; });
            }
          }} onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") { event.currentTarget.value = data.name; event.currentTarget.blur(); }
          }} />
      </label>
      <div className="budget-lists">
        <NamedList kind="initiative" items={data.initiatives} disabled={disabled} onEdit={onEdit} />
        <NamedList kind="account" items={data.accounts} disabled={disabled} onEdit={onEdit} />
      </div>
      <section className="budget-months" aria-label="年月の登録">
        <h2>年月</h2>
        <form className="budget-add" onSubmit={(event) => {
          event.preventDefault();
          void onEdit({ type: "month", month }).then((done) => { if (done) setMonth(""); });
        }}>
          <input type="month" min="0001-01" max="9999-12" aria-label="追加する年月" value={month}
            onChange={(event) => setMonth(event.target.value)} required disabled={disabled} />
          <button disabled={disabled || !month}>追加</button>
        </form>
        <p>{data.months.length ? data.months.join(" / ") : "年月を追加してください。"}</p>
      </section>
    </> : <DataTable data={data[section]} />}
  </section>;
}
