import { addAmounts } from "./amounts";
import { buildCostTable } from "./costTable";
import { initiativesForKind, initiativeMonths, type Initiative, type PlanContents } from "./initiatives";
import type { KindId } from "./kindAmounts";
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
    row[month] = addAmounts(row[month] ?? 0, Number(record.amount));
  }
  return result;
}
export function buildKindCostTable(contents: PlanContents, selected: KindId[]) {
  const previous = previousByAccount(contents);
  const kinds = selected.map(kind => buildCostTable(contents.accounts, contents.aggregations, initiativesForKind(contents.initiatives, contents.accounts, kind, contents.revisedActive), contents.fiscalYear, previous));
  const skeleton = kinds[0] ?? buildCostTable(contents.accounts, contents.aggregations, [], contents.fiscalYear, previous);
  return skeleton.map((row, index) => ({ ...row, values: [row.previous, ...kinds.map(rows => rows[index]!.budget)] }));
}
export function previousTotals(contents: PlanContents): ExpansionTotals {
  const amounts = previousByAccount(contents);
  return Object.fromEntries(initiativeMonths.map(month => {
    let sales = 0, profit = 0;
    for (const account of contents.accounts) {
      const amount = amounts.get(account.id)?.[month] ?? 0;
      if (account.accountType === "sales") { sales = addAmounts(sales, amount); profit = addAmounts(profit, amount); }
      if (account.accountType === "cost") { sales = addAmounts(sales, -amount); profit = addAmounts(profit, -amount); }
      if (account.accountType === "expense") profit = addAmounts(profit, -amount);
      if (account.accountType === "profit") profit = addAmounts(profit, amount);
    }
    return [month, { sales, profit }];
  }));
}
export function combineTotals(left: Initiative["months"], right: Initiative["months"], sign = 1): ExpansionTotals {
  return Object.fromEntries(initiativeMonths.map(month => [month, {
    sales: left[month]?.sales === null || right[month]?.sales === null ? null : addAmounts(left[month]?.sales ?? 0, (right[month]?.sales ?? 0) * sign),
    profit: left[month]?.profit === null || right[month]?.profit === null ? null : addAmounts(left[month]?.profit ?? 0, (right[month]?.profit ?? 0) * sign),
  }]));
}
export function buildKindExpansionTable(contents: PlanContents, selected: KindId[], sort: ExpansionSort) {
  const first = initiativesForKind(contents.initiatives, contents.accounts, selected[0] ?? 2, contents.revisedActive);
  const second = initiativesForKind(contents.initiatives, contents.accounts, selected[1] ?? 4, contents.revisedActive);
  const table = buildExpansionTable({ ...contents, initiatives: first }, contents.fiscalYear, sort);
  const prior = previousTotals(contents);
  const firstTotal = totalInitiatives(first), secondTotal = totalInitiatives(second);
  return {
    previous: [prior, prior, combineTotals(prior, prior, -1)],
    total: [combineTotals(prior, firstTotal), combineTotals(prior, secondTotal), combineTotals(secondTotal, firstTotal, -1)],
    changes: [firstTotal, secondTotal, combineTotals(secondTotal, firstTotal, -1)],
    groups: table.groups.map(group => {
      const next = second.filter(item => item.expansionId === group.expansion.id);
      const nextTotal = totalInitiatives(next);
      return { ...group, values: [group.total, nextTotal, combineTotals(nextTotal, group.total, -1)], initiatives: group.initiatives.map(item => {
        const latter = next.find(next => next.id === item.id)!;
        return { ...item, values: [item.months, latter.months, combineTotals(latter.months, item.months, -1)] };
      }) };
    }),
  };
}
