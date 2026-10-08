import { useRowWindow, WindowRows } from "./VirtualTableRows";
import { TableCalculationBoundary } from "./TableCalculationBoundary";
import { initiativesForKind } from "../core/tables/initiatives";
import type { Account } from "../core/domain/accountMaster";
import { initiativeTotals } from "../core/tables/initiativeTotals";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { initiativeMonths } from "../core/domain/calendar";
import { type Initiative } from "../core/domain/plan";
import type { Expansion } from "../core/domain/expansionMaster";
import type { PeriodType } from "../core/domain/periodMaster";
import type { KindId } from "../core/domain/kinds";

import { sortInitiatives, type InitiativeSort } from "../core/tables/initiativeSort";

import { formatYen } from "../core/domain/amounts";
const amountText = (amount: number | null | undefined) => amount === undefined ? "" : amount === null ? "属性未設定" : formatYen(amount);

type InitiativeListPageProps = {
  selection: ReactNode;
  selectedKind: KindId;
  initiatives: Initiative[];
  accounts: Account[];
  expansions: Expansion[];
  periodTypes: PeriodType[];
  fiscalYear: string;
  onAddInitiative: () => void;
  onOpenInitiative: (initiative: Initiative) => void;
  navigationBlocked: boolean;
};

export function InitiativeListPage({ selection, selectedKind, initiatives, accounts, expansions, periodTypes, fiscalYear, onAddInitiative, onOpenInitiative, navigationBlocked }: InitiativeListPageProps) {
  const readOnly = useHistoryReadOnly();
  const [sort, setSort] = useState<InitiativeSort | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const expansionNames = new Map(expansions.map(item => [item.id, item.expansionName]));
  const periodNames = new Map(periodTypes.map(item => [item.id, item.periodName]));
  const { source, errors } = useMemo(() => {
    const current = initiatives.filter(item => (item.fiscalYear === null ? "" : String(item.fiscalYear)) === fiscalYear);
    const errors = new Map<number, string>();
    try { return { source: initiativesForKind(current, accounts, selectedKind), errors }; }
    catch {
      // Isolate a failed initiative and keep its name available for correction.
      const source = current.map(item => {
        try { return initiativesForKind([item], accounts, selectedKind)[0]!; }
        catch (failure) {
          errors.set(item.id, failure instanceof Error ? failure.message : "金額を表示できませんでした。");
          return item;
        }
      });
      return { source, errors };
    }
  }, [initiatives, accounts, selectedKind, fiscalYear]);
  const displayed = sortInitiatives(source, sort, selectedKind, expansionNames, periodNames);
  const window = useRowWindow(container, displayed.length, 28, 200, 56);
  const virtual = displayed.length > 200;
  const sortHeader = (column: InitiativeSort["column"], label: string, className: string) => {
    const active = sort?.column === column;
    return <th rowSpan={2} scope="col" className={`initiative-list-fixed ${className}`} aria-sort={active ? sort.direction : undefined}>
      <button className="initiative-sort-button" type="button" onClick={() => setSort({ column, direction: active && sort.direction === "ascending" ? "descending" : "ascending" })}>
        {label}{active && <span className="initiative-sort-indicator" aria-hidden="true">{sort.direction === "ascending" ? "▲" : "▼"}</span>}
      </button>
    </th>;
  };
  return <main className="initiative-list-page initiative-overview-page" aria-labelledby="initiative-list-title">
    <div className="initiative-list-heading">
      <h1 id="initiative-list-title">施策一覧</h1>
      {selection}
      <button className="primary-button" type="button" disabled={navigationBlocked || readOnly} onClick={onAddInitiative}>施策を追加</button>
    </div>
    <TableCalculationBoundary resetKeys={[initiatives, accounts, selectedKind, fiscalYear]}>
    <div ref={container} className="initiative-list-container" role="region" aria-label="施策一覧の月別売上・費用・利益" tabIndex={0}>
      <table className={`initiative-list-table${virtual ? " virtual-table" : ""}`} style={{ "--virtual-row-height": "28px" } as React.CSSProperties} aria-label="施策一覧" aria-rowcount={displayed.length + 3}>
        <colgroup>
          <col className="initiative-expansion-column" />
          <col className="initiative-period-column" />
          <col className="initiative-name-column" />
          <col className="initiative-start-column" />
          <col span={36} />
        </colgroup>
        <thead>
          <tr>
            {sortHeader("expansion", "展開名", "initiative-list-expansion")}
            {sortHeader("period", "期間名", "initiative-list-period")}
            {sortHeader("name", "施策名", "initiative-list-name")}
            {sortHeader("start", "開始年月", "initiative-list-start")}
            {initiativeMonths.map(month => <th key={month} colSpan={3} scope="colgroup">{month}月</th>)}
          </tr>
          <tr>{initiativeMonths.map(month => <Fragment key={month}>
            <th scope="col">売上</th><th scope="col">費用</th><th scope="col" className="initiative-month-end">利益</th>
          </Fragment>)}</tr>
        </thead>
        <tbody><WindowRows items={displayed.slice(window.start, window.end).map((item, offset) => ({ item, index: window.start + offset }))} count={displayed.length} height={28} columns={40} render={(item, index) => <tr key={item.id} aria-rowindex={index + 3}>
          <td className="initiative-list-fixed initiative-list-expansion">{expansionNames.get(item.expansionId ?? -1) ?? ""}</td>
          <td className="initiative-list-fixed initiative-list-period">{periodNames.get(item.periodTypeId ?? -1) ?? ""}</td>
          <th scope="row" className="initiative-list-fixed initiative-list-name" title={item.note || item.name}>
            <button className="initiative-name-button" type="button" disabled={navigationBlocked} onClick={() => onOpenInitiative(item)}>{item.name}</button>
          </th>
          <td className="initiative-list-fixed initiative-list-start">{item.startYearMonths[selectedKind]}</td>
          {errors.has(item.id) ? <td colSpan={36} role="alert" style={{ textAlign: "left" }}>{errors.get(item.id)} 施策を開いて金額を修正してください。</td> : initiativeMonths.map(month => <Fragment key={month}>
            <td>{amountText(item.months[month]?.sales)}</td>
            <td>{amountText(item.months[month]?.expense)}</td>
            <td className="initiative-month-end">{amountText(item.months[month]?.profit)}</td>
          </Fragment>)}
        </tr>} /></tbody>
        <tfoot>{errors.size ? <tr className="initiative-total-row"><th colSpan={40} scope="row" style={{ textAlign: "left" }}>計算できない施策があるため、合計を表示できません。</th></tr> : <InitiativeTotalRow initiatives={source} />}</tfoot>
      </table>
    </div>
    </TableCalculationBoundary>
    {source.length === 0 && <p className="page-description">表示する施策がありません。</p>}
  </main>;
}

function InitiativeTotalRow({ initiatives }: { initiatives: Initiative[] }) {
  const result = useMemo(() => {
    try { return { totals: initiativeTotals(initiatives), error: null }; }
    catch (error) { return { totals: null, error: error instanceof Error ? error.message : "合計を表示できませんでした。" }; }
  }, [initiatives]);
  if (!result.totals) return <tr className="initiative-total-row"><th colSpan={40} scope="row" role="alert">{result.error} 施策を開いて金額を修正してください。</th></tr>;
  const totals = result.totals;
  return <tr className="initiative-total-row">
    <th colSpan={4} scope="row" className="initiative-total-label">合計</th>
    {initiativeMonths.map(month => <Fragment key={month}>
      <td>{amountText(totals[month]?.sales)}</td>
      <td>{amountText(totals[month]?.expense)}</td>
      <td className="initiative-month-end">{amountText(totals[month]?.profit)}</td>
    </Fragment>)}
  </tr>;
}
