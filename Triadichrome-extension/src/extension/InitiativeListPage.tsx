import { useHistoryReadOnly } from "./HistoryReadOnly";
import { Fragment, type ReactNode } from "react";
import { initiativeMonths } from "../core/domain/calendar";
import { type Initiative } from "../core/domain/plan";

import { formatAmount } from "../core/domain/amounts";
const amountText = (amount: number | null | undefined) => amount === undefined ? "" : amount === null ? "属性未設定" : formatAmount(amount);

type InitiativeListPageProps = {
  selection: ReactNode;
  initiatives: Initiative[];
  fiscalYear: string;
  onAddInitiative: () => void;
  onOpenInitiative: (initiative: Initiative) => void;
  navigationBlocked: boolean;
};

export function InitiativeListPage({ selection, initiatives, fiscalYear, onAddInitiative, onOpenInitiative, navigationBlocked }: InitiativeListPageProps) {
  const readOnly = useHistoryReadOnly();
  const source = initiatives.filter(item => (item.fiscalYear === null ? "" : String(item.fiscalYear)) === fiscalYear);
  return <main className="initiative-list-page initiative-overview-page" aria-labelledby="initiative-list-title">
    <div className="initiative-list-heading">
      <h1 id="initiative-list-title">施策一覧</h1>
      <span className="field-hint">単位：千円</span>
      {selection}
      <button className="primary-button" type="button" disabled={navigationBlocked || readOnly} onClick={onAddInitiative}>施策を追加</button>
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
            <button className="initiative-name-button" type="button" disabled={navigationBlocked} onClick={() => onOpenInitiative(item)}>{item.name}</button>
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
