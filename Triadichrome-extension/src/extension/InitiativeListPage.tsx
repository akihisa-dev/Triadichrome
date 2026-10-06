import { Fragment } from "react";
import { initiativeMonths, type Initiative } from "../core/initiatives";

import { formatAmount } from "../core/amounts";
const amountText = (amount: number | null | undefined) => amount === undefined ? "" : amount === null ? "属性未設定" : formatAmount(amount);

type InitiativeListPageProps = {
  initiatives: Initiative[];
  fiscalYear: string;
  onOpenInitiative: (initiative: Initiative) => void;
};

export function InitiativeListPage({ initiatives, fiscalYear, onOpenInitiative }: InitiativeListPageProps) {
  const source = initiatives.filter(item => (item.fiscalYear === null ? "" : String(item.fiscalYear)) === fiscalYear);
  return <main className="initiative-list-page initiative-overview-page" aria-labelledby="initiative-list-title">
    <div className="initiative-list-heading">
      <h1 id="initiative-list-title">施策一覧</h1>
      <span className="field-hint">単位：千円</span>
    </div>
    <div className="initiative-list-container" role="region" aria-label="施策一覧の月別売上・費用・利益" tabIndex={0}>
      <table className="initiative-list-table" aria-label="施策一覧">
        <thead>
          <tr>
            <th rowSpan={2} scope="col" className="initiative-list-name">施策名</th>
            {initiativeMonths.map(month => <th key={month} colSpan={3} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>
            <th scope="col">売上</th><th scope="col">費用</th><th scope="col" className="initiative-month-end">利益</th>
          </Fragment>)}</tr>
        </thead>
        <tbody>{source.map(item => <tr key={item.id}>
          <th scope="row" className="initiative-list-name" title={item.note || item.name}>
            <button className="initiative-name-button" type="button" onClick={() => onOpenInitiative(item)}>{item.name}</button>
          </th>
          {initiativeMonths.map(month => <Fragment key={month}>
            <td>{amountText(item.months[month]?.sales)}</td>
            <td>{amountText(item.months[month]?.expense)}</td>
            <td className="initiative-month-end">{amountText(item.months[month]?.profit)}</td>
          </Fragment>)}
        </tr>)}</tbody>
      </table>
    </div>
    {source.length === 0 && <p className="page-description">表示する施策がありません。</p>}
  </main>;
}
