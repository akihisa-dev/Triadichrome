import type { ReactNode } from "react";
import { Fragment, useMemo } from "react";
import { buildKindCostTable } from "../core/planTables";
import type { KindId } from "../core/kindAmounts";
import { initiativeMonths, type PlanContents } from "../core/initiatives";

import { formatAmount, formatRate } from "../core/amounts";

type Props = { contents: PlanContents; selected: KindId[]; selection: ReactNode; onOpenMaster: () => void };

export function CostTablePage({ contents, selected, selection, onOpenMaster }: Props) {
  const { accounts, aggregations } = contents;
  const labels = ["前年", ...selected.map(id => contents.kinds.find(kind => kind.id === id)!.kindName)];
  const rows = useMemo(() => buildKindCostTable(contents, selected), [contents, selected]);
  const salesGroupId = aggregations.find(group => group.required === "sales")?.id;
  const salesIndex = rows.findIndex(row => row.kind === "group" && row.id === salesGroupId);
  const renderRow = (row: (typeof rows)[number]) => <tr key={`${row.kind}:${row.id}`} className={`cost-data-row${row.kind !== "account" ? ` cost-subtotal${row.required ? " cost-required" : ""}` : ""}${row.kind === "group" && row.id === salesGroupId ? " cost-sales-anchor" : ""}`}>
    <th scope="row" className="initiative-list-name">{row.name}{!row.configured && <span className="cost-unconfigured">未設定</span>}</th>
    {initiativeMonths.map(month => <Fragment key={month}>{row.values.map((values, index) => <td key={index} className={index === labels.length - 1 ? "initiative-month-end" : undefined}>{row.kind === "ratio" ? formatRate(values[month]) : formatAmount(values[month])}</td>)}</Fragment>)}
  </tr>;
  const assigned = new Set(aggregations.flatMap(group => group.members.filter(member => member.kind === "account").map(member => member.id)));
  const unassigned = accounts.filter(account => !assigned.has(account.id));
  return <main className="initiative-list-page cost-table-page" aria-labelledby="cost-table-title">
    {selection}
    <div className="initiative-list-heading">
      <h1 id="cost-table-title">総原価表</h1>
      <span className="field-hint">単位：千円</span>
    </div>
    {(unassigned.length > 0 || rows.some(row => !row.configured)) && <p className="page-description cost-master-guide">
      {unassigned.length > 0 ? `集計に未所属の科目が${unassigned.length}件あります。` : "計算対象が未設定の集計があります。"}
      <button type="button" className="text-button" onClick={onOpenMaster}>集計マスタを開く</button>
    </p>}
    <div className="initiative-list-container cost-table-container" role="region" aria-label="総原価表の月別前年・種別別金額" tabIndex={0}>
      <table className="initiative-list-table cost-table" aria-label="総原価表">
        <colgroup>
          <col className="cost-name-column" />
          {initiativeMonths.flatMap(month => labels.map((_, index) => <col key={`${month}:${index}`} className="cost-amount-column" />))}
        </colgroup>
        <thead>
          <tr><th rowSpan={2} scope="col" className="initiative-list-name">科目・集計</th>
            {initiativeMonths.map(month => <th key={month} colSpan={labels.length} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.map((_, index) => <th key={index} scope="col">{labels[index]}</th>)}</Fragment>)}</tr>
          {rows.slice(0, salesIndex + 1).map(renderRow)}
        </thead>
        <tbody>{rows.slice(salesIndex + 1).map(renderRow)}</tbody>
      </table>
    </div>
  </main>;
}
