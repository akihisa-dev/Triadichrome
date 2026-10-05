import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn } from "../core/tableView";
import { Fragment, useMemo, useState } from "react";
import { buildKindCostTable } from "../core/planTables";
import type { KindId } from "../core/kindAmounts";
import { initiativeMonths, type PlanContents } from "../core/initiatives";

import { formatAmount, formatRate } from "../core/amounts";

type Props = { contents: PlanContents; selected: KindId[]; onOpenMaster: () => void };

export function CostTablePage({ contents, selected, onOpenMaster }: Props) {
  const { accounts, aggregations } = contents;
  const labels = ["前年", ...selected.map(id => contents.kinds.find(kind => kind.id === id)!.kindName)];
  const rows = useMemo(() => buildKindCostTable(contents, selected), [contents, selected]);
  const [view, setView] = useState(emptyTableView);
  type Row = typeof rows[number];
  const columns: TableColumn<Row>[] = [{ id: "name", label: "科目・集計", value: row => row.name }, ...initiativeMonths.flatMap(month => labels.map((label, index) => ({ id: `${index}-${month}`, label: `${month}月${label}`, numeric: true, display: (row: Row) => row.kind === "ratio" ? formatRate(row.values[index]?.[month]) : formatAmount(row.values[index]?.[month]), value: (row: Row) => row.values[index]?.[month] ?? null })))];
  // Keep each calculated subtotal anchored; sort only the account block preceding it.
  const visible: Row[] = []; let block: Row[] = [];
  for (const row of rows) { if (row.kind === "account") block.push(row); else { visible.push(...applyTableView(block, columns, view), ...applyTableView([row], columns, { ...view, sort: null })); block = []; } }
  visible.push(...applyTableView(block, columns, view));
  const assigned = new Set(aggregations.flatMap(group => group.members.filter(member => member.kind === "account").map(member => member.id)));
  const unassigned = accounts.filter(account => !assigned.has(account.id));
  return <main className="initiative-list-page" aria-labelledby="cost-table-title">
    <div className="initiative-list-heading">
      <h1 id="cost-table-title">総原価表</h1>
      <button type="button" onClick={() => setView(emptyTableView())}>クリア</button>
      <span className="field-hint">単位：千円</span>
      <span>{contents.fiscalYear}年度</span>
    </div>
    {(unassigned.length > 0 || rows.some(row => !row.configured)) && <p className="page-description cost-master-guide">
      {unassigned.length > 0 ? `集計に未所属の科目が${unassigned.length}件あります。` : "計算対象が未設定の集計があります。"}
      <button type="button" className="text-button" onClick={onOpenMaster}>集計マスタを開く</button>
    </p>}
    <div className="initiative-list-container" role="region" aria-label="総原価表の月別前年・種別別金額" tabIndex={0}>
      <table className="initiative-list-table cost-table" aria-label="総原価表">
        <thead>
          <tr><th rowSpan={2} scope="col" className="initiative-list-name"><TableHeader column={columns[0]!} rows={rows} view={view} onChange={setView} /></th>
            {initiativeMonths.map(month => <th key={month} colSpan={labels.length} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.map((_, index) => <th key={index} scope="col"><TableHeader column={columns.find(item => item.id === `${index}-${month}`)!} rows={rows} view={view} onChange={setView} /></th>)}</Fragment>)}</tr>
        </thead>
        <tbody>{visible.map(row => <tr key={`${row.kind}:${row.id}`} className={row.kind !== "account" ? `cost-subtotal${row.required ? " cost-required" : ""}` : undefined}>
          <th scope="row" className="initiative-list-name">{row.name}{!row.configured && <span className="cost-unconfigured">未設定</span>}</th>
          {initiativeMonths.map(month => <Fragment key={month}>{row.values.map((values, index) => <td key={index} className={index === labels.length - 1 ? "initiative-month-end" : undefined}>{row.kind === "ratio" ? formatRate(values[month]) : formatAmount(values[month])}</td>)}</Fragment>)}
        </tr>)}</tbody>
      </table>
    </div>
  </main>;
}
