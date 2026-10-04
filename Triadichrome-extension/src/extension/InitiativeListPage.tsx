import { Fragment } from "react";
import { initiativeMonths, type Initiative } from "../core/initiatives";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 10 });
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
  const visible = initiatives.filter(item => (item.fiscalYear === null ? "" : String(item.fiscalYear)) === fiscalYear);
  return <main className="initiative-list-page" aria-labelledby="initiative-list-title">
    <div className="initiative-list-heading">
      <h1 id="initiative-list-title">施策一覧</h1>
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
            <th rowSpan={2} scope="col" className="initiative-list-name">施策名</th>
            {initiativeMonths.map(month => <th key={month} colSpan={2} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>
            <th scope="col">売上</th><th scope="col" className="initiative-month-end">利益</th>
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
