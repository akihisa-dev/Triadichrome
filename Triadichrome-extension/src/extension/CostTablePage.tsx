import { TableCalculationBoundary } from "./TableCalculationBoundary";
import { periodCellClass } from "./periodCellStyle";
import type { ReactNode } from "react";
import { Fragment, memo, useMemo, useState, useLayoutEffect } from "react";
import { buildPeriodCostComparison, tablePeriods } from "../core/tables/periodTables";
import { filterPlan } from "../core/tables/planTables";
import "./CostClassification.css";
import "./KindSelectionSlots.css";
import type { KindId } from "../core/domain/kinds";
import { type PlanContents } from "../core/domain/plan";

import { formatTableYen, formatTableRate } from "./tableNumberFormat";

type Props = { contents: PlanContents; selected: KindId[]; selection: ReactNode; onOpenMaster?: () => void };

export function CostTablePage({ contents, selected, selection }: Props) {
  const [industryIds, setIndustries] = useState<number[]>([]);
  const [departmentIds, setDepartments] = useState<number[]>([]);
  const available = contents;
  const departments = departmentIds.filter(id => available.departments.some(item => item.id === id));
  const allowedIndustries = available.departments.filter(item => !departments.length || departments.includes(item.id)).flatMap(item => item.industryIds);
  const industries = industryIds.filter(id => allowedIndustries.includes(id) && available.industries.some(item => item.id === id));
  useLayoutEffect(() => {
    if (industries.length !== industryIds.length) setIndustries(industries);
    if (departments.length !== departmentIds.length) setDepartments(departments);
  }, [available, industryIds, departmentIds]);
  const filtered = useMemo(() => {
    const industries = industryIds.filter(id => allowedIndustries.includes(id) && contents.industries.some(item => item.id === id));
    const departments = departmentIds.filter(id => contents.departments.some(item => item.id === id));
    return filterPlan(contents, {
      industries: industries.length ? industries : null,
      departments: departments.length ? departments : null,
    });
  }, [contents.accounts, contents.aggregations, contents.initiatives, contents.previousAmounts, contents.fiscalYear,
    contents.kinds, contents.industries, contents.departments, industryIds, departmentIds]);
  return <main className="initiative-list-page cost-table-page" aria-labelledby="cost-table-title">
    <div className="initiative-list-heading">
      <h1 id="cost-table-title">総原価表</h1>
      {selection}
    </div>
    <div className="cost-classification-row">
      <div className="classification-field">
        <label htmlFor="cost-department">部署名</label>
        <select id="cost-department" value={departments[0] ?? ""} onChange={event => {
          const value = event.target.value === "" ? [] : [Number(event.target.value)];
          setDepartments(value);
          const ids = available.departments.filter(item => !value.length || value.includes(item.id)).flatMap(item => item.industryIds);
          setIndustries(current => value.length === 1 && ids.length === 1 ? ids : current.filter(id => ids.includes(id)));
        }}>
          <option value="">全部署の合計</option>
          {available.departments.map(item => <option key={item.id} value={item.id}>{item.departmentName}</option>)}
        </select>
      </div>
      <div className="classification-field">
        <label htmlFor="cost-industry">業種名</label>
        <select id="cost-industry" value={industries[0] ?? ""} onChange={event => setIndustries(event.target.value === "" ? [] : [Number(event.target.value)])}>
          <option value="">全業種の合計</option>
          {available.industries.filter(item => allowedIndustries.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.industryName}</option>)}
        </select>
      </div>
    </div>
    <TableCalculationBoundary resetKeys={[contents, selected, industryIds, departmentIds]}>
      <CostTableContents contents={filtered} selected={selected} />
    </TableCalculationBoundary>
  </main>;
}

const CostTableContents = memo(function CostTableContents({ contents, selected }: Pick<Props, "contents" | "selected">) {
  const comparisons = useMemo(() => new Map<string, ReturnType<typeof buildPeriodCostComparison>>(), [contents]);
  const key = [...selected].sort().join(",");
  let table = comparisons.get(key);
  if (!table) {
    table = buildPeriodCostComparison(contents, selected);
    comparisons.set(key, table);
  }
  const { labels, rows } = table;
  const salesGroupId = contents.aggregations.find(group => group.required === "sales")?.id;
  const salesIndex = rows.findIndex(row => row.kind === "group" && row.id === salesGroupId);
  const renderRow = (row: (typeof rows)[number]) => <tr key={`${row.kind}:${row.id}`} className={`cost-data-row${row.kind !== "account" ? ` cost-subtotal${row.required ? " cost-required" : ""}` : ""}${row.kind === "group" && row.id === salesGroupId ? " cost-sales-anchor" : ""}`}>
    <th scope="row" className="initiative-list-name">{row.name}{!row.configured && <span className="cost-unconfigured">未設定</span>}</th>
    {tablePeriods.map(period => <Fragment key={period.id}>{row.values.map((values, index) => <td key={index} className={periodCellClass(period, index === 0, index === labels.length - 1)}>{row.kind === "ratio" ? formatTableRate(values[period.id], labels[index] === "前年差" || labels[index] === "一次予算差") : formatTableYen(values[period.id])}</td>)}</Fragment>)}
  </tr>;
  return <div className="initiative-list-container cost-table-container" role="region" aria-label="総原価表の月別前年・種別別金額" tabIndex={0}>
      <table className="initiative-list-table cost-table" aria-label="総原価表">
        <colgroup>
          <col className="cost-name-column" />
          {tablePeriods.flatMap(period => labels.map((_, index) => <col key={`${period.id}:${index}`} className="cost-amount-column" />))}
        </colgroup>
        <thead>
          <tr><th rowSpan={2} scope="col" className="initiative-list-name">科目・集計</th>
            {tablePeriods.map(period => <th key={period.id} colSpan={labels.length} scope="colgroup" className={periodCellClass(period, true)}>{period.label}</th>)}
          </tr>
          <tr>{tablePeriods.map(period => <Fragment key={period.id}>{labels.map((_, index) => <th key={index} scope="col" className={periodCellClass(period, index === 0)}>{labels[index]}</th>)}</Fragment>)}</tr>
          {rows.slice(0, salesIndex + 1).map(renderRow)}
        </thead>
        <tbody>{rows.slice(salesIndex + 1).map(renderRow)}</tbody>
      </table>
    </div>;
});
