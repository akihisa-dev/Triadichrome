import type { ReactNode } from "react";
import { Fragment } from "react";
import { initiativeMonths } from "../core/domain/calendar";
import { type Initiative, type PlanContents } from "../core/domain/plan";
import { buildKindExpansionTable } from "../core/tables/planTables";
import type { KindId } from "../core/domain/kinds";
import { formatAmount } from "../core/domain/amounts";

type Props = {
  contents: PlanContents; selected: KindId[]; selection: ReactNode;
  onOpenInitiative: (initiative: Initiative) => void;
};
function AmountCells({ values }: { values: Initiative["months"][] }) {
  return initiativeMonths.map(month => <Fragment key={month}>{values.map((months, index) => <Fragment key={index}>
    <td title={months[month]?.sales === null ? "属性未設定" : formatAmount(months[month]?.sales)}>{months[month]?.sales === null ? "属性未設定" : formatAmount(months[month]?.sales)}</td>
    <td title={months[month]?.profit === null ? "属性未設定" : formatAmount(months[month]?.profit)} className={index === values.length - 1 ? "initiative-month-end" : undefined}>{months[month]?.profit === null ? "属性未設定" : formatAmount(months[month]?.profit)}</td>
  </Fragment>)}</Fragment>);
}
export function ExpansionTablePage({ contents, selected, selection, onOpenInitiative }: Props) {
  const table = buildKindExpansionTable(contents, selected, "registered");
  const labels = [...selected.map(id => contents.kinds.find(kind => kind.id === id)!.kindName), ...(selected.length === 2 ? ["比較"] : [])];
  return <main className="initiative-list-page expansion-table-page" aria-labelledby="expansion-table-title">
    <div className="initiative-list-heading">
      <h1 id="expansion-table-title">展開表</h1>
      <span className="field-hint">単位：千円</span>
      {selection}
      {selected.length === 2 && <span className="field-hint">比較：確定予算 − 一次予算</span>}
    </div>
    <div className="initiative-list-container" role="region" aria-label="展開表の月別種別・比較" tabIndex={0}>
      <table className="initiative-list-table expansion-table" aria-label="展開表">
        <colgroup>
          <col className="expansion-group-col" /><col className="expansion-name-col" />
          {initiativeMonths.flatMap(month => labels.flatMap((_, index) => ["sales", "profit"].map(metric =>
            <col key={`${month}-${index}-${metric}`} className="expansion-amount-col" />)))}
        </colgroup><thead>
        <tr><th rowSpan={3} scope="col" className="expansion-group">展開名</th>
          <th rowSpan={3} scope="col" className="expansion-name">施策名</th>
          {initiativeMonths.map(month => <th key={month} colSpan={labels.length * 2} scope="colgroup">{month}月</th>)}
        </tr>
        <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.map((label, index) => <th key={index} scope="colgroup" colSpan={2}>{label}</th>)}</Fragment>)}</tr>
        <tr>{initiativeMonths.map(month => <Fragment key={month}>{labels.flatMap((_, index) => (["sales", "profit"] as const).map(key => <th key={`${index}-${key}`} scope="col">{key === "sales" ? "売上" : "利益"}</th>))}</Fragment>)}</tr>
      </thead><tbody>
        <tr><th colSpan={2} scope="row" className="expansion-summary">前年</th><AmountCells values={table.previous} /></tr>
        <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">合計</th><AmountCells values={table.total} /></tr>
        <tr className="expansion-total"><th colSpan={2} scope="row" className="expansion-summary">展開計</th><AmountCells values={table.changes} /></tr>
      </tbody>
      {table.groups.map(group => { return <tbody key={group.expansion.id}>
        {group.initiatives.map((item, index) => <tr key={item.id}>
          {index === 0 && <th rowSpan={group.initiatives.length + 1} scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          <th scope="row" className="expansion-name"><button className="initiative-name-button" type="button" title={item.note || item.name} onClick={() => onOpenInitiative(item)}>{item.name}</button></th>
          <AmountCells values={item.values} />
        </tr>)}
        <tr className="expansion-subtotal">{group.initiatives.length === 0 && <th scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          <th scope="row" className="expansion-name">{group.expansion.expansionName}計</th><AmountCells values={group.values} />
        </tr>
      </tbody>; })}</table>
    </div>
  </main>;
}
