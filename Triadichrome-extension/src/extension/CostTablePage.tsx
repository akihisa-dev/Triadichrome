import { Fragment, useMemo } from "react";
import { buildCostTable } from "../core/costTable";
import { currentFiscalYear, initiativeMonths, type PlanContents } from "../core/initiatives";

import { formatAmount, formatRate } from "../core/amounts";

type Props = { contents: PlanContents; fiscalYear: string; onYearChange: (year: string) => void; onOpenMaster: () => void };

export function CostTablePage({ contents, fiscalYear, onYearChange, onOpenMaster }: Props) {
  const { accounts, aggregations, initiatives } = contents;
  const years = [...new Set([Number(fiscalYear), currentFiscalYear(), ...initiatives.flatMap(item => item.fiscalYear === null ? [] : [item.fiscalYear])])].sort((a, b) => b - a);
  const rows = useMemo(() => buildCostTable(accounts, aggregations, initiatives, Number(fiscalYear)), [accounts, aggregations, initiatives, fiscalYear]);
  const assigned = new Set(aggregations.flatMap(group => group.members.filter(member => member.kind === "account").map(member => member.id)));
  const unassigned = accounts.filter(account => !assigned.has(account.id));
  return <main className="initiative-list-page" aria-labelledby="cost-table-title">
    <div className="initiative-list-heading">
      <h1 id="cost-table-title">総原価表</h1>
      <span className="field-hint">単位：千円</span>
      <div className="initiative-field initiative-year-field">
        <label htmlFor="cost-table-year">年度</label>
        <select id="cost-table-year" value={fiscalYear} onChange={event => onYearChange(event.target.value)}>
          {years.map(year => <option key={year} value={year}>{year}年度</option>)}
        </select>
      </div>
    </div>
    {(unassigned.length > 0 || rows.some(row => !row.configured)) && <p className="page-description cost-master-guide">
      {unassigned.length > 0 ? `集計に未所属の科目が${unassigned.length}件あります。` : "計算対象が未設定の集計があります。"}
      <button type="button" className="text-button" onClick={onOpenMaster}>集計マスタを開く</button>
    </p>}
    <div className="initiative-list-container" role="region" aria-label="総原価表の月別前年・予算・対予算" tabIndex={0}>
      <table className="initiative-list-table cost-table" aria-label="総原価表">
        <thead>
          <tr><th rowSpan={2} scope="col" className="initiative-list-name">科目・集計</th>
            {initiativeMonths.map(month => <th key={month} colSpan={3} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}><th scope="col">前年</th><th scope="col">予算</th><th scope="col" className="initiative-month-end">対予算</th></Fragment>)}</tr>
        </thead>
        <tbody>{rows.map(row => <tr key={`${row.kind}:${row.id}`} className={row.kind !== "account" ? `cost-subtotal${row.required ? " cost-required" : ""}` : undefined}>
          <th scope="row" className="initiative-list-name">{row.name}{!row.configured && <span className="cost-unconfigured">未設定</span>}</th>
          {initiativeMonths.map(month => <Fragment key={month}>
            <td>{row.kind === "ratio" ? formatRate(row.previous[month]) : formatAmount(row.previous[month])}</td>
            <td>{row.kind === "ratio" ? formatRate(row.budget[month]) : formatAmount(row.budget[month])}</td>
            <td className="initiative-month-end">{row.kind === "ratio" ? formatRate(row.comparison[month], true) : formatAmount(row.comparison[month])}</td>
          </Fragment>)}
        </tr>)}</tbody>
      </table>
    </div>
  </main>;
}
