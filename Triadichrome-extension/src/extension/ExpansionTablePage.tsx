import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn, type TableView } from "../core/tableView";
import { Fragment } from "react";
import { initiativeMonths, type Initiative, type PlanContents } from "../core/initiatives";
import { buildKindExpansionTable } from "../core/planTables";
import type { KindId } from "../core/kindAmounts";
import { type ExpansionSort } from "../core/expansionTable";
import { formatAmount } from "../core/amounts";

type Props = {
  contents: PlanContents; selected: KindId[]; view: TableView; onViewChange: (view: TableView) => void;
  sort: ExpansionSort; onSortChange: (sort: ExpansionSort) => void; onOpenInitiative: (initiative: Initiative) => void;
};
function AmountCells({ values }: { values: Initiative["months"][] }) {
  return initiativeMonths.map(month => <Fragment key={month}>{values.map((months, index) => <Fragment key={index}>
    <td>{months[month]?.sales === null ? "属性未設定" : formatAmount(months[month]?.sales)}</td>
    <td className={index === values.length - 1 ? "initiative-month-end" : undefined}>{months[month]?.profit === null ? "属性未設定" : formatAmount(months[month]?.profit)}</td>
  </Fragment>)}</Fragment>);
}
export function ExpansionTablePage({ contents, selected, sort, onSortChange, onOpenInitiative, view, onViewChange: setView }: Props) {
  const table = buildKindExpansionTable(contents, selected, sort);
  const labels = [...selected.map(id => contents.kinds.find(kind => kind.id === id)!.kindName), "比較"];
  type Row = typeof table.groups[number]["initiatives"][number];
  const columns: TableColumn<Row>[] = [{ id: "name", label: "施策名", value: item => item.name }, { id: "expansion", label: "展開名", value: item => contents.expansions.find(group => group.id === item.expansionId)?.expansionName ?? null }, ...initiativeMonths.flatMap(month => labels.flatMap((label, index) => (["sales", "profit"] as const).map(key => ({ id: `${index}-${key}-${month}`, label: `${month}月${label}${key === "sales" ? "売上" : "利益"}`, numeric: true, amount: true, value: (item: Row) => item.values[index]?.[month]?.[key] ?? null }))))];
  const source = table.groups.flatMap(group => group.initiatives);
  return <main className="initiative-list-page expansion-table-page" aria-labelledby="expansion-table-title">
    <div className="initiative-list-heading"><h1 id="expansion-table-title">展開表</h1><span>{contents.fiscalYear}年度</span><span className="field-hint">単位：千円</span>
      <span className="field-hint">比較：{labels[1]} − {labels[0]}</span>
      <button type="button" onClick={() => { setView(emptyTableView()); onSortChange("registered"); }}>クリア</button>
    </div>
    <div className="initiative-list-container" role="region" aria-label="展開表の月別種別・比較" tabIndex={0}>
      <table className="initiative-list-table expansion-table" aria-label="展開表"><thead>
        <tr><th rowSpan={3} scope="col" className="expansion-group"><TableHeader column={columns[1]!} rows={source} view={view} onChange={setView} /></th>
          <th rowSpan={3} scope="col" className="expansion-name"><TableHeader column={columns[0]!} rows={source} view={view} onChange={setView} /></th>
          {initiativeMonths.map(month => <th key={month} colSpan={6} scope="colgroup">{month}月</th>)}
        </tr>
        <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.map((label, index) => <th key={index} scope="colgroup" colSpan={2}>{label}</th>)}</Fragment>)}</tr>
        <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.flatMap((_, index) => (["sales", "profit"] as const).map(key => <th key={`${index}-${key}`} scope="col"><TableHeader column={columns.find(item => item.id === `${index}-${key}-${month}`)!} rows={source} view={view} onChange={setView} /></th>))}</Fragment>)}</tr>
      </thead><tbody>
        <tr><th colSpan={2} scope="row" className="expansion-summary">前年</th><AmountCells values={table.previous} /></tr>
        <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">合計</th><AmountCells values={table.total} /></tr>
        <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">展開計</th><AmountCells values={table.changes} /></tr>
      </tbody>
      {table.groups.map(group => { const visible = applyTableView(group.initiatives, columns, view); return <tbody key={group.expansion.id}>
        {visible.map((item, index) => <tr key={item.id}>
          {index === 0 && <th rowSpan={visible.length + 1} scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          <th scope="row" className="expansion-name"><button className="initiative-name-button" type="button" title={item.note || item.name} onClick={() => onOpenInitiative(item)}>{item.name}</button></th>
          <AmountCells values={item.values} />
        </tr>)}
        <tr className="expansion-subtotal">{visible.length === 0 && <th scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          <th scope="row" className="expansion-name">{group.expansion.expansionName}計</th><AmountCells values={group.values} />
        </tr>
      </tbody>; })}</table>
    </div>
  </main>;
}
