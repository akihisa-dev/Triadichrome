import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn } from "../core/tableView";
import { Fragment, useState } from "react";
import { initiativeMonths, type Initiative } from "../core/initiatives";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 });
const amountText = (amount: number | null | undefined) => amount === undefined ? "" : amount === null ? "属性未設定" : format.format(amount);

type InitiativeListPageProps = {
  initiatives: Initiative[];
  fiscalYear: string;
  onYearChange: (year: string) => void;
  onOpenInitiative: (initiative: Initiative) => void;
};

export function InitiativeListPage({ initiatives, fiscalYear, onYearChange, onOpenInitiative }: InitiativeListPageProps) {
  const years = [...new Set([fiscalYear, ...initiatives.map(item => item.fiscalYear === null ? "" : String(item.fiscalYear))])]
    .sort((a, b) => Number(b) - Number(a));
  const [view, setView] = useState(emptyTableView);
  const columns: TableColumn<Initiative>[] = [{ id: "name", label: "施策名", value: item => item.name }, ...initiativeMonths.flatMap(month => [
    { id: `sales-${month}`, label: `${month}月売上`, numeric: true, value: (item: Initiative) => item.months[month]?.sales ?? null },
    { id: `profit-${month}`, label: `${month}月利益`, numeric: true, value: (item: Initiative) => item.months[month]?.profit ?? null },
  ])];
  const source = initiatives.filter(item => (item.fiscalYear === null ? "" : String(item.fiscalYear)) === fiscalYear);
  const visible = applyTableView(source, columns, view);
  return <main className="initiative-list-page" aria-labelledby="initiative-list-title">
    <div className="initiative-list-heading">
      <h1 id="initiative-list-title">施策一覧</h1>
      <button type="button" onClick={() => setView(emptyTableView())}>クリア</button>
      <span className="field-hint">単位：千円</span>
      <div className="initiative-field initiative-year-field">
        <label htmlFor="initiative-list-year">年度</label>
        <select id="initiative-list-year" value={fiscalYear} onChange={event => onYearChange(event.target.value)}>
          {years.map(year => <option key={year} value={year}>{year ? `${year}年度` : "年度未設定"}</option>)}
        </select>
      </div>
    </div>
    <div className="initiative-list-container" role="region" aria-label="施策一覧の月別売上・利益" tabIndex={0}>
      <table className="initiative-list-table" aria-label="施策一覧">
        <thead>
          <tr>
            <th rowSpan={2} scope="col" className="initiative-list-name"><TableHeader column={columns[0]!} rows={source} view={view} onChange={setView} /></th>
            {initiativeMonths.map(month => <th key={month} colSpan={2} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>
            <th scope="col"><TableHeader column={columns.find(item => item.id === `sales-${month}`)!} rows={source} view={view} onChange={setView} /></th><th scope="col" className="initiative-month-end"><TableHeader column={columns.find(item => item.id === `profit-${month}`)!} rows={source} view={view} onChange={setView} /></th>
          </Fragment>)}</tr>
        </thead>
        <tbody>{visible.map(item => <tr key={item.id}>
          <th scope="row" className="initiative-list-name" title={item.note || item.name}>
            <button className="initiative-name-button" type="button" onClick={() => onOpenInitiative(item)}>{item.name}</button>
          </th>
          {initiativeMonths.map(month => <Fragment key={month}>
            <td>{amountText(item.months[month]?.sales)}</td>
            <td className="initiative-month-end">{amountText(item.months[month]?.profit)}</td>
          </Fragment>)}
        </tr>)}</tbody>
      </table>
    </div>
    {visible.length === 0 && <p className="page-description">この年度の施策はまだ登録されていません。</p>}
  </main>;
}
