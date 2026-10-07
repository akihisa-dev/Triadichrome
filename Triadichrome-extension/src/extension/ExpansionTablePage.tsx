import { periodCellClass } from "./periodCellStyle";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { expansionPeriodAmount, tablePeriods } from "../core/tables/periodTables";
import { type Initiative, type PlanContents } from "../core/domain/plan";
import { buildKindExpansionTable } from "../core/tables/planTables";
import type { KindId } from "../core/domain/kinds";
import { formatTableYen } from "./tableNumberFormat";

type Props = {
  contents: PlanContents; selected: KindId[]; selection: ReactNode;
  onOpenInitiative: (initiative: Initiative) => void;
};
function AmountCells({ values }: { values: Initiative["months"][] }) {
  return tablePeriods.map(period => <Fragment key={period.id}>{values.map((months, index) => <Fragment key={index}>
    {(["sales", "profit"] as const).map(metric => {
      const amount = expansionPeriodAmount(months, period, metric);
      const text = amount === null ? "属性未設定" : formatTableYen(amount);
      return <td key={metric} title={text} className={periodCellClass(period, metric === "sales" && index === 0, metric === "profit" && index === values.length - 1)}>{text}</td>;
    })}
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
          {tablePeriods.flatMap(period => labels.flatMap((_, index) => ["sales", "profit"].map(metric =>
            <col key={`${period.id}-${index}-${metric}`} className="expansion-amount-col" />)))}
        </colgroup><thead>
        <tr><th rowSpan={3} scope="col" className="expansion-group">展開名</th>
          <th rowSpan={3} scope="col" className="expansion-name">施策名</th>
          {tablePeriods.map(period => <th key={period.id} colSpan={labels.length * 2} scope="colgroup" className={periodCellClass(period, true)}>{period.label}</th>)}
        </tr>
        <tr>{tablePeriods.map(period => <Fragment key={period.id}>{labels.map((label, index) => <th key={index} scope="colgroup" colSpan={2} className={periodCellClass(period, index === 0)}>{label}</th>)}</Fragment>)}</tr>
        <tr>{tablePeriods.map(period => <Fragment key={period.id}>{labels.flatMap((_, index) => (["sales", "profit"] as const).map(key => <th key={`${index}-${key}`} scope="col" className={periodCellClass(period, key === "sales" && index === 0)}>{key === "sales" ? "売上" : "利益"}</th>))}</Fragment>)}</tr>
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
