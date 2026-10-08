import { useRowWindow, WindowRows } from "./VirtualTableRows";
import { TableCalculationBoundary } from "./TableCalculationBoundary";
import { periodCellClass } from "./periodCellStyle";
import type { ReactNode } from "react";
import { Fragment, useMemo, useRef } from "react";
import { expansionPeriodAmount, tablePeriods } from "../core/tables/periodTables";
import { type Initiative, type PlanContents } from "../core/domain/plan";
import { buildKindExpansionTable } from "../core/tables/planTables";
import type { KindId } from "../core/domain/kinds";
import { groupExpansionPeriods } from "../core/tables/expansionTable";
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
  return <main className="initiative-list-page expansion-table-page" aria-labelledby="expansion-table-title">
    <div className="initiative-list-heading">
      <h1 id="expansion-table-title">展開表</h1>
      <span className="field-hint">単位：千円</span>
      {selection}
      {selected.length === 2 && <span className="field-hint">比較：確定予算 − 一次予算</span>}
    </div>
    <TableCalculationBoundary resetKeys={[contents, selected]}>
      <ExpansionTableContents contents={contents} selected={selected} onOpenInitiative={onOpenInitiative} />
    </TableCalculationBoundary>
  </main>;
}

function ExpansionTableContents({ contents, selected, onOpenInitiative }: Omit<Props, "selection">) {
  const table = useMemo(() => buildKindExpansionTable(contents, selected, "registered"), [contents, selected]);
  const container = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => table.groups.flatMap(group => {
    const periods = groupExpansionPeriods(group.initiatives, contents.periodTypes);
    const count = group.initiatives.length + 1;
    let offset = 0;
    const items = periods.flatMap(period => period.initiatives.map((item, index) => {
      const row = { group, item, period, groupOffset: offset, groupCount: count, periodOffset: index, subtotal: false };
      offset++;
      return row;
    }));
    return [...items, { group, item: null, period: null, groupOffset: offset, groupCount: count, periodOffset: 0, subtotal: true }];
  }), [table, contents.periodTypes]);
  const window = useRowWindow(container, flat.length, 40, 200, 240);
  const virtual = flat.length > 200;
  const labels = [...selected.map(id => contents.kinds.find(kind => kind.id === id)!.kindName), ...(selected.length === 2 ? ["比較"] : [])];
  return <div ref={container} className="initiative-list-container" role="region" aria-label="展開表の月別種別・比較" tabIndex={0}>
      <table className={`initiative-list-table expansion-table${virtual ? " virtual-table" : ""}`} style={{ "--virtual-row-height": "40px" } as React.CSSProperties} aria-label="展開表" aria-rowcount={flat.length + 6}>
        <colgroup>
          <col className="expansion-group-col" /><col className="expansion-period-col" /><col className="expansion-name-col" />
          {tablePeriods.flatMap(period => labels.flatMap((_, index) => ["sales", "profit"].map(metric =>
            <col key={`${period.id}-${index}-${metric}`} className="expansion-amount-col" />)))}
        </colgroup><thead>
        <tr><th rowSpan={3} scope="col" className="expansion-group">展開名</th>
          <th rowSpan={3} scope="col" className="expansion-period">期間名</th>
          <th rowSpan={3} scope="col" className="expansion-name">施策名</th>
          {tablePeriods.map(period => <th key={period.id} colSpan={labels.length * 2} scope="colgroup" className={periodCellClass(period, true)}>{period.label}</th>)}
        </tr>
        <tr>{tablePeriods.map(period => <Fragment key={period.id}>{labels.map((label, index) => <th key={index} scope="colgroup" colSpan={2} className={periodCellClass(period, index === 0)}>{label}</th>)}</Fragment>)}</tr>
        <tr>{tablePeriods.map(period => <Fragment key={period.id}>{labels.flatMap((_, index) => (["sales", "profit"] as const).map(key => <th key={`${index}-${key}`} scope="col" className={periodCellClass(period, key === "sales" && index === 0)}>{key === "sales" ? "売上" : "利益"}</th>))}</Fragment>)}</tr>
      </thead><tbody>
        <tr><th colSpan={3} scope="row" className="expansion-summary">前年</th><AmountCells values={table.previous} /></tr>
        <tr className="expansion-total"><th colSpan={3} scope="row" className="expansion-summary">合計</th><AmountCells values={table.total} /></tr>
        <tr className="expansion-total"><th colSpan={3} scope="row" className="expansion-summary">展開計</th><AmountCells values={table.changes} /></tr>
      </tbody>
      {virtual ? <tbody><WindowRows items={flat.slice(window.start, window.end).map((item, offset) => ({ item, index: window.start + offset }))} count={flat.length} height={40} columns={3 + labels.length * tablePeriods.length * 2} render={(row, index) => {
        const firstGroup = row.groupOffset === 0 || index === window.start;
        const groupSpan = Math.min(row.groupCount - row.groupOffset, window.end - index);
        const firstPeriod = row.periodOffset === 0 || index === window.start;
        const periodSpan = Math.min((row.period?.initiatives.length ?? 0) - row.periodOffset, window.end - index);
        return <tr key={row.item?.id ?? `subtotal:${row.group.expansion.id}`} className={row.subtotal ? "expansion-subtotal" : undefined} aria-rowindex={index + 7}>
          {firstGroup && <th rowSpan={groupSpan} scope="rowgroup" className="expansion-group" title={row.group.expansion.expansionName}>{row.group.expansion.expansionName}</th>}
          {row.subtotal ? <><th colSpan={2} scope="row" className="expansion-subtotal-name">{row.group.expansion.expansionName}計</th><AmountCells values={row.group.values} /></>
            : <>{firstPeriod && <th rowSpan={periodSpan} className="expansion-period">{row.period!.name}</th>}
              <th scope="row" className="expansion-name"><button className="initiative-name-button" type="button" title={row.item!.note || row.item!.name} onClick={() => onOpenInitiative(row.item!)}>{row.item!.name}</button></th><AmountCells values={row.item!.values} /></>}
        </tr>;
      }} /></tbody> : table.groups.map(group => { return <tbody key={group.expansion.id}>
        {groupExpansionPeriods(group.initiatives, contents.periodTypes).map((period, periodIndex) => period.initiatives.map((item, index) => <tr key={item.id}>
          {periodIndex === 0 && index === 0 && <th rowSpan={group.initiatives.length + 1} scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          {index === 0 && <th rowSpan={period.initiatives.length} className="expansion-period">{period.name}</th>}
          <th scope="row" className="expansion-name"><button className="initiative-name-button" type="button" title={item.note || item.name} onClick={() => onOpenInitiative(item)}>{item.name}</button></th>
          <AmountCells values={item.values} />
        </tr>))}
        <tr className="expansion-subtotal">{group.initiatives.length === 0 && <th scope="rowgroup" className="expansion-group">{group.expansion.expansionName}</th>}
          <th colSpan={2} scope="row" className="expansion-subtotal-name">{group.expansion.expansionName}計</th><AmountCells values={group.values} />
        </tr>
      </tbody>; })}</table>
    </div>;
}
