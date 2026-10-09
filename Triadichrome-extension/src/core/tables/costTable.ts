import { orderedMasterRows } from "../domain/masterRows";
import { addYen, amountToYen } from "../domain/amounts";
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

function sum(target: MonthlyAmounts, source: MonthlyAmounts, sign = 1): void {
  for (const month of initiativeMonths) {
    if (source[month] !== undefined) target[month] = addYen(target[month] ?? 0, source[month]! * sign);
  }
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
  for (const initiative of initiatives) {
    if (initiative.fiscalYear !== fiscalYear) continue;
    for (const input of initiative.rows) {
      const row = input.accountId === null ? undefined : byAccount.get(input.accountId);
      if (!row) continue;
      for (const month of initiativeMonths) {
        const amount = input.amounts[month];
        if (amount !== undefined && amount !== "") sum(row.changes, { [month]: amountToYen(amount) });
      }
    }
  }
  for (const row of byAccount.values()) {
    sum(row.budget, row.previous);
    sum(row.budget, row.changes);
  }
  const byGroup = new Map<number, CostRow>();
  const parents = new Map<number, number>();
  const pending = new Map<number, number>();
  const definitions = new Map(groups.map(group => [group.id, group]));
  const queue: Aggregation[] = [];
  for (const group of groups) {
    const children = group.members.filter(member => member.kind === "group");
    pending.set(group.id, children.length);
    for (const child of children) parents.set(child.id, group.id);
    if (!children.length) queue.push(group);
  }
  for (let index = 0; index < queue.length; index++) {
    const group = queue[index]!;
    const row: CostRow = { kind: "group", id: group.id, name: group.displayName ?? group.name, required: group.required !== null,
      configured: group.members.length > 0, previous: {}, changes: {}, budget: {}, comparison: {} };
    for (const member of group.members) {
      const child = (member.kind === "account" ? byAccount : byGroup).get(member.id)!;
      row.configured &&= child.configured;
      sum(row.previous, child.previous, member.sign);
      sum(row.changes, child.changes, member.sign);
      sum(row.budget, child.budget, member.sign);
    }
    if (!row.configured) { row.previous = {}; row.changes = {}; row.budget = {}; }
    byGroup.set(group.id, row);
    const parentId = parents.get(group.id);
    if (parentId !== undefined) {
      const remaining = pending.get(parentId)! - 1;
      pending.set(parentId, remaining);
      if (remaining === 0) queue.push(definitions.get(parentId)!);
    }
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
