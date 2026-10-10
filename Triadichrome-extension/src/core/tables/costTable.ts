import { orderedMasterRows } from "../domain/masterRows";
import { childFirstAggregations } from "../domain/aggregationOrder";
import { addYen, amountToYen, checkedYen } from "../domain/amounts";
import { type Account } from "../domain/accountMaster";
import { validateAggregations, type Aggregation } from "../domain/aggregations";
import { initiativeMonths, type InitiativeMonth } from "../domain/calendar";
import { type Initiative } from "../domain/plan";

/** Monetary columns use integer yen; ratio rows use percentages. */
type MonthlyAmounts = Partial<Record<InitiativeMonth, number>>;
export type CostRow = {
  kind: "account" | "group" | "ratio"; id: number; name: string; required: boolean; configured: boolean;
  previous: MonthlyAmounts; changes: MonthlyAmounts; budget: MonthlyAmounts; comparison: MonthlyAmounts;
};

type ExactMonthlyAmounts = Partial<Record<InitiativeMonth, bigint>>;
function sum(target: ExactMonthlyAmounts, source: MonthlyAmounts, sign = 1): void {
  for (const month of initiativeMonths) {
    if (source[month] === undefined) continue;
    if (!Number.isSafeInteger(source[month])) throw new Error("金額が正確に計算できる範囲を超えています。");
    target[month] = (target[month] ?? 0n) + BigInt(source[month]!) * BigInt(sign);
  }
}
function finish(values: ExactMonthlyAmounts): MonthlyAmounts {
  return Object.fromEntries(initiativeMonths.flatMap(month => values[month] === undefined ? [] : [[month, checkedYen(values[month]!)]]));
}

/** Previous-year totals are a separate baseline, never another year's initiatives. */
export function buildCostTable(accounts: Account[], groups: Aggregation[], initiatives: Initiative[], fiscalYear: number,
  previousAmounts: ReadonlyMap<number, MonthlyAmounts> = new Map()): CostRow[] {
  validateAggregations(groups, new Set(accounts.map(account => account.id)));
  const byAccount = new Map<number, CostRow>();
  for (const account of accounts) byAccount.set(account.id, {
    kind: "account", id: account.id, name: account.displayName ?? account.accountName, required: false, configured: true,
    previous: { ...previousAmounts.get(account.id) }, changes: {}, budget: {}, comparison: {},
  });
  const changes = new Map(accounts.map(account => [account.id, {} as ExactMonthlyAmounts]));
  for (const initiative of initiatives) {
    if (initiative.fiscalYear !== fiscalYear) continue;
    for (const input of initiative.rows) {
      const row = input.accountId === null ? undefined : byAccount.get(input.accountId);
      if (!row) continue;
      for (const month of initiativeMonths) {
        const amount = input.amounts[month];
        if (amount !== undefined && amount !== "") sum(changes.get(row.id)!, { [month]: amountToYen(amount) });
      }
    }
  }
  for (const row of byAccount.values()) {
    row.changes = finish(changes.get(row.id)!);
    const budget: ExactMonthlyAmounts = {};
    sum(budget, row.previous);
    sum(budget, row.changes);
    row.budget = finish(budget);
  }
  const byGroup = new Map<number, CostRow>();
  for (const group of childFirstAggregations(groups)) {
    const row: CostRow = { kind: "group", id: group.id, name: group.displayName ?? group.name, required: group.required !== null,
      configured: group.members.length > 0, previous: {}, changes: {}, budget: {}, comparison: {} };
    const previous: ExactMonthlyAmounts = {}, changes: ExactMonthlyAmounts = {}, budget: ExactMonthlyAmounts = {};
    for (const member of group.members) {
      const child = (member.kind === "account" ? byAccount : byGroup).get(member.id)!;
      row.configured &&= child.configured;
      sum(previous, child.previous, member.sign);
      sum(changes, child.changes, member.sign);
      sum(budget, child.budget, member.sign);
    }
    if (row.configured) {
      row.previous = finish(previous); row.changes = finish(changes); row.budget = finish(budget);
    }
    byGroup.set(group.id, row);
  }
  const output = orderedMasterRows(accounts,groups).map(row => (row.kind === "account" ? byAccount : byGroup).get(row.id)!);
  const sales = byGroup.get(groups.find(group => group.required === "sales")!.id)!;
  const ordinary = byGroup.get(groups.find(group => group.required === "ordinary")!.id)!;
  const ratio: CostRow = { kind: "ratio", id: ordinary.id, name: "利益率", required: true,
    configured: sales.configured && ordinary.configured, previous: {}, changes: {}, budget: {}, comparison: {} };
  for (const column of ["previous", "budget"] as const) {
    for (const month of initiativeMonths) {
      const denominator = sales[column][month];
      const numerator = ordinary[column][month];
      if (ratio.configured && denominator !== undefined && denominator !== 0 && numerator !== undefined) {
        ratio[column][month] = numerator / denominator * 100;
      }
    }
  }
  output.splice(output.indexOf(ordinary) + 1, 0, ratio);
  for (const row of output) for (const month of initiativeMonths) {
    const previous = row.previous[month];
    const budget = row.budget[month];
    if (previous !== undefined && budget !== undefined) {
      row.comparison[month] = row.kind === "ratio" ? previous - budget : addYen(previous, -budget);
    }
  }
  return output;
}
