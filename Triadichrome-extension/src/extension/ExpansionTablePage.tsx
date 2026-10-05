import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn, type TableView } from "../core/tableView";
import { Fragment } from "react";
import { initiativeMonths, type Initiative, type PlanContents } from "../core/initiatives";
import { buildExpansionTable, type ExpansionSort, type ExpansionTotals } from "../core/expansionTable";

import { formatAmount } from "../core/amounts";
const amountText = (amount: number | null | undefined) => amount === undefined ? "" : amount === null ? "属性未設定" : formatAmount(amount);

function AmountCells({ months }: { months: Initiative["months"] | ExpansionTotals }) {
  return initiativeMonths.map(month => <Fragment key={month}>
    <td>{amountText(months[month]?.sales)}</td>
    <td className="initiative-month-end">{amountText(months[month]?.profit)}</td>
  </Fragment>);
}

type Props = {
  contents: PlanContents;
  fiscalYear: string;
  onYearChange: (year: string) => void;
  view: TableView;
  onViewChange: (view: TableView) => void;
  sort: ExpansionSort;
  onSortChange: (sort: ExpansionSort) => void;
  onOpenInitiative: (initiative: Initiative) => void;
};

export function ExpansionTablePage({ contents, fiscalYear, onYearChange, sort, onSortChange, onOpenInitiative, view, onViewChange: setView }: Props) {
  const years = [...new Set([fiscalYear, ...contents.initiatives.flatMap(item => item.fiscalYear === null ? [] : [String(item.fiscalYear)])])]
    .sort((a, b) => Number(b) - Number(a));
  const table = buildExpansionTable(contents, Number(fiscalYear), sort);
  const columns: TableColumn<Initiative>[] = [{ id: "name", label: "施策名", value: item => item.name }, { id: "expansion", label: "展開名", value: item => contents.expansions.find(group => group.id === item.expansionId)?.expansionName ?? null }, ...initiativeMonths.flatMap(month => [
    { id: `sales-${month}`, label: `${month}月売上`, numeric: true, amount: true, value: (item: Initiative) => item.months[month]?.sales ?? null },
    { id: `profit-${month}`, label: `${month}月利益`, numeric: true, amount: true, value: (item: Initiative) => item.months[month]?.profit ?? null },
  ])];
  const source = table.groups.flatMap(group => group.initiatives);
  return <main className="initiative-list-page expansion-table-page" aria-labelledby="expansion-table-title">
    <div className="initiative-list-heading">
      <h1 id="expansion-table-title">展開表</h1>
      <span className="field-hint">単位：千円</span>
      <div className="initiative-field initiative-year-field">
        <label htmlFor="expansion-table-year">年度</label>
        <select id="expansion-table-year" value={fiscalYear} onChange={event => onYearChange(event.target.value)}>
          {years.map(year => <option key={year} value={year}>{year}年度</option>)}
        </select>
      </div>
      <button type="button" onClick={() => { setView(emptyTableView()); onSortChange("registered"); }}>クリア</button>
    </div>
    <div className="initiative-list-container" role="region" aria-label="展開表の月別売上・利益" tabIndex={0}>
      <table className="initiative-list-table expansion-table" aria-label="展開表">
        <colgroup><col className="expansion-group-col" /><col className="expansion-name-col" />
          {initiativeMonths.map(month => <Fragment key={month}><col /><col /></Fragment>)}
        </colgroup>
        <thead>
          <tr><th rowSpan={2} scope="col" className="expansion-group"><TableHeader column={columns[1]!} rows={source} view={view} onChange={setView} /></th>
            <th rowSpan={2} scope="col" className="expansion-name"><TableHeader column={columns[0]!} rows={source} view={view} onChange={setView} /></th>
            {initiativeMonths.map(month => <th key={month} colSpan={2} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}><th scope="col"><TableHeader column={columns.find(item => item.id === `sales-${month}`)!} rows={source} view={view} onChange={setView} /></th><th scope="col" className="initiative-month-end"><TableHeader column={columns.find(item => item.id === `profit-${month}`)!} rows={source} view={view} onChange={setView} /></th></Fragment>)}</tr>
        </thead>
        <tbody>
          <tr><th colSpan={2} scope="row" className="expansion-summary">前年</th><AmountCells months={{}} /></tr>
          <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">合計</th><AmountCells months={table.total} /></tr>
          <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">展開計</th><AmountCells months={table.total} /></tr>
        </tbody>
        {table.groups.map(({ expansion, initiatives: original, total }) => { const initiatives = applyTableView(original, columns, view); return <tbody key={expansion.id}>
          {initiatives.map((item, index) => <tr key={item.id}>
            {index === 0 && <th rowSpan={initiatives.length + 1} scope="rowgroup" className="expansion-group">{expansion.expansionName}</th>}
            <th scope="row" className="expansion-name" title={item.note || item.name}>
              <button className="initiative-name-button" type="button" onClick={() => onOpenInitiative(item)}>{item.name}</button>
            </th>
            <AmountCells months={item.months} />
          </tr>)}
          <tr className="expansion-subtotal">
            {initiatives.length === 0 && <th scope="rowgroup" className="expansion-group">{expansion.expansionName}</th>}
            <th scope="row" className="expansion-name">{expansion.expansionName}計</th><AmountCells months={total} />
          </tr>
        </tbody>; })}
      </table>
    </div>
  </main>;
}
