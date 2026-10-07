import { periodCellClass } from "./periodCellStyle";
import type { ReactNode } from "react";
import { Fragment, useState, useLayoutEffect } from "react";
import { buildPeriodCostComparison, tablePeriods } from "../core/tables/periodTables";
import { filterPlan } from "../core/tables/planTables";
import { ChoiceChips } from "./ChoiceChips";
import "./KindSelectionSlots.css";
import type { KindId } from "../core/domain/kinds";
import { type PlanContents } from "../core/domain/plan";

import { formatTableYen, formatTableRate } from "./tableNumberFormat";

type Props = { contents: PlanContents; selected: KindId[]; selection: ReactNode; onOpenMaster?: () => void };

export function CostTablePage({ contents, selected, selection }: Props) {
  const { aggregations } = contents;
  const [industryIds, setIndustries] = useState<number[]>([]);
  const [departmentIds, setDepartments] = useState<number[]>([]);
  const available = contents;
  const industries = industryIds.filter(id => available.industries.some(item => item.id === id));
  const departments = departmentIds.filter(id => available.departments.some(item => item.id === id));
  useLayoutEffect(() => {
    if (industries.length !== industryIds.length) setIndustries(industries);
    if (departments.length !== departmentIds.length) setDepartments(departments);
  }, [available, industryIds, departmentIds]);
  const { labels, rows } = buildPeriodCostComparison(filterPlan(contents, {
    industries: industries.length ? industries : null,
    departments: departments.length ? departments : null,
  }), selected);
  const salesGroupId = aggregations.find(group => group.required === "sales")?.id;
  const salesIndex = rows.findIndex(row => row.kind === "group" && row.id === salesGroupId);
  const renderRow = (row: (typeof rows)[number]) => <tr key={`${row.kind}:${row.id}`} className={`cost-data-row${row.kind !== "account" ? ` cost-subtotal${row.required ? " cost-required" : ""}` : ""}${row.kind === "group" && row.id === salesGroupId ? " cost-sales-anchor" : ""}`}>
    <th scope="row" className="initiative-list-name">{row.name}{!row.configured && <span className="cost-unconfigured">未設定</span>}</th>
    {tablePeriods.map(period => <Fragment key={period.id}>{row.values.map((values, index) => <td key={index} className={periodCellClass(period, index === 0, index === labels.length - 1)}>{row.kind === "ratio" ? formatTableRate(values[period.id], labels[index] === "前年差" || labels[index] === "一次予算差") : formatTableYen(values[period.id])}</td>)}</Fragment>)}
  </tr>;
  return <main className="initiative-list-page cost-table-page" aria-labelledby="cost-table-title">
    <div className="initiative-list-heading">
      <h1 id="cost-table-title">総原価表</h1>
      <span className="field-hint">単位：千円</span>
      {selection}
    </div>
    <div className="cost-classification-row">
      <ChoiceChips id="cost-industry" label="業種名" value={industries} emptyLabel="全業種の合計"
        options={available.industries.map(item => ({ id: item.id, name: item.industryName }))}
        disabled={false} onChange={setIndustries} />
      <ChoiceChips id="cost-department" label="部署名" value={departments} emptyLabel="全部署の合計"
        options={available.departments.map(item => ({ id: item.id, name: item.departmentName }))}
        disabled={false} onChange={setDepartments} />
    </div>
    <div className="initiative-list-container cost-table-container" role="region" aria-label="総原価表の月別前年・種別別金額" tabIndex={0}>
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
    </div>
  </main>;
}
