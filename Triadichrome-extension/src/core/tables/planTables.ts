import { accountEffectsYen } from "../domain/accountEffects";
import { amountToYen } from "../domain/amounts";
import { addYen } from "../domain/amounts";
import { buildCostTable } from "./costTable";
import { initiativesForKind } from "./initiatives";
import { initiativeMonths } from "../domain/calendar";
import { type Initiative, type PlanContents } from "../domain/plan";
import type { KindId } from "../domain/kinds";
import { buildExpansionTable, totalInitiatives, type ExpansionSort, type ExpansionTotals } from "./expansionTable";

export type ClassificationFilter = { industries: number[] | null; departments: number[] | null };
export const allClassifications = (): ClassificationFilter => ({ industries: null, departments: null });
export function matchesClassification(filter: ClassificationFilter, industry: number | null | undefined, department: number | null | undefined): boolean {
  return (filter.industries === null || (industry != null && filter.industries.includes(industry))) && (filter.departments === null || (department != null && filter.departments.includes(department)));
}
export function filterPlan(contents: PlanContents, filter: ClassificationFilter): PlanContents {
  return { ...contents, initiatives: contents.initiatives.filter(item => matchesClassification(filter, item.industryId, item.departmentId)), previousAmounts: contents.previousAmounts.filter(item => matchesClassification(filter, item.industryId, item.departmentId)), details: contents.details?.filter(item => matchesClassification(filter, item.industryId, item.departmentId)) };
}
export function previousByAccount(contents: PlanContents) {
  const result = new Map<number, Partial<Record<typeof initiativeMonths[number], number>>>();
  for (const account of contents.accounts) result.set(account.id, Object.fromEntries(initiativeMonths.map(month => [month, 0])));
  for (const record of contents.previousAmounts) {
    const row = result.get(record.accountId)!;
    const month = record.month as typeof initiativeMonths[number];
    row[month] = addYen(row[month] ?? 0, amountToYen(record.amount));
  }
  return result;
}
export function buildKindCostTable(contents: PlanContents, selected: KindId[]) {
  const previous = previousByAccount(contents);
  const kinds = selected.map(kind => buildCostTable(contents.accounts, contents.aggregations, initiativesForKind(contents.initiatives, contents.accounts, kind), contents.fiscalYear, previous));
  const skeleton = kinds[0] ?? buildCostTable(contents.accounts, contents.aggregations, [], contents.fiscalYear, previous);
  return skeleton.map((row, index) => ({ ...row, values: [row.previous, ...kinds.map(rows => rows[index]!.budget)] }));
}
export function previousTotals(contents: PlanContents): ExpansionTotals {
  const amounts = previousByAccount(contents);
  return Object.fromEntries(initiativeMonths.map(month => {
    let sales = 0, profit = 0;
    for (const account of contents.accounts) {
      const amount = amounts.get(account.id)?.[month] ?? 0;
      const effects = accountEffectsYen(amount, account.accountType);
      sales = addYen(sales, effects.sales); profit = addYen(profit, effects.profit);
    }
    return [month, { sales, profit }];
  }));
}
export function combineTotals(left: Initiative["months"], right: Initiative["months"], sign = 1): ExpansionTotals {
  return Object.fromEntries(initiativeMonths.map(month => [month, {
    sales: left[month]?.sales === null || right[month]?.sales === null ? null : addYen(left[month]?.sales ?? 0, (right[month]?.sales ?? 0) * sign),
    profit: left[month]?.profit === null || right[month]?.profit === null ? null : addYen(left[month]?.profit ?? 0, (right[month]?.profit ?? 0) * sign),
  }]));
}
export function buildKindExpansionTable(contents: PlanContents, selected: KindId[], sort: ExpansionSort) {
  const projections = selected.map(kind => initiativesForKind(contents.initiatives, contents.accounts, kind));
  const indexes = projections.map(items => {
    const byId = new Map<number, Initiative>();
    const byExpansion = new Map<number | null, Initiative[]>();
    for (const item of items) {
      if (!byId.has(item.id)) byId.set(item.id, item);
      const members = byExpansion.get(item.expansionId) ?? [];
      members.push(item); byExpansion.set(item.expansionId, members);
    }
    return { byId, byExpansion };
  });
  const table = buildExpansionTable({ ...contents, initiatives: projections[0]! }, contents.fiscalYear, sort);
  const prior = previousTotals(contents);
  const compare = (values: Initiative["months"][]) => selected.length === 2
    ? [...values, combineTotals(values[selected.indexOf(2)]!, values[selected.indexOf(1)]!, -1)] : values;
  const totals = projections.map(totalInitiatives);
  return {
    previous: compare(selected.map(() => prior)),
    total: compare(totals.map(total => combineTotals(prior, total))),
    changes: compare(totals),
    groups: table.groups.map(group => {
      const members = indexes.map(index => index.byExpansion.get(group.expansion.id) ?? []);
      return { ...group, values: compare(members.map(totalInitiatives)), initiatives: group.initiatives.map(item => ({
        ...item, values: compare(indexes.map(index => index.byId.get(item.id)!.months)),
      })) };
    }),
  };
}
