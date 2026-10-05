import { addAmounts } from "./amounts";
import { initiativeMonths, type Initiative, type InitiativeMonth, type PlanContents } from "./initiatives";

export type DashboardMetric = "sales" | "profit";
export type DashboardDirection = "increase" | "decrease";
export type Contribution = { initiativeId: number; amount: number };
export type DashboardNode = { key: string; name: string; value: number; contributions: Contribution[]; children: DashboardNode[] };
export type DashboardFlow = Contribution & { expansionId: number | null; accountId: number; expansion: string; account: string; initiative: string };
export type DashboardImpact = { initiative: Initiative; sales: number | null; profit: number | null };

/** Null means no entered amount; explicit zero and cancelling amounts remain zero. */
export function sumDashboardAmounts(amounts: (number | null | undefined)[]): number | null {
  let result: number | null = null;
  for (const amount of amounts) if (amount !== null && amount !== undefined) result = addAmounts(result ?? 0, amount);
  return result;
}

export function dashboardNode(key: string, name: string, contributions: Contribution[] = [], children: DashboardNode[] = []): DashboardNode {
  const all = [...contributions, ...children.flatMap(child => child.contributions)];
  return { key, name, children, contributions: all, value: sumDashboardAmounts(all.map(item => Math.abs(item.amount))) ?? 0 };
}

export function buildDashboard(contents: PlanContents, fiscalYear: number) {
  const initiatives = contents.initiatives.filter(item => item.fiscalYear === fiscalYear);
  const impacts: DashboardImpact[] = initiatives.map(initiative => ({ initiative,
    sales: sumDashboardAmounts(initiativeMonths.map(month => initiative.months[month]?.sales)),
    profit: sumDashboardAmounts(initiativeMonths.map(month => initiative.months[month]?.profit)),
  }));
  const months = initiativeMonths.map(month => ({ month,
    sales: sumDashboardAmounts(initiatives.map(item => item.months[month]?.sales)),
    profit: sumDashboardAmounts(initiatives.map(item => item.months[month]?.profit)),
  }));
  return { impacts, months,
    sales: sumDashboardAmounts(impacts.map(item => item.sales)), profit: sumDashboardAmounts(impacts.map(item => item.profit)) };
}

const matchesDirection = (amount: number, direction: DashboardDirection) => direction === "increase" ? amount > 0 : amount < 0;

/** Split net annual initiative impacts, so a measure appears once in each metric. */
export function buildImpactTree(contents: PlanContents, impacts: DashboardImpact[], metric: DashboardMetric, direction: DashboardDirection, grouping: "expansion" | "department") {
  const groups = grouping === "expansion"
    ? contents.expansions.map(item => ({ id: item.id, name: item.expansionName }))
    : contents.departments.map(item => ({ id: item.id, name: item.departmentName }));
  const nodes = [...groups, { id: null, name: "未選択" }].map(group => dashboardNode(`${grouping}:${group.id}`, group.name, [],
    impacts.filter(item => (grouping === "expansion" ? item.initiative.expansionId : item.initiative.departmentId ?? null) === group.id)
      .filter(item => item[metric] !== null && matchesDirection(item[metric]!, direction))
      .map(item => dashboardNode(`initiative:${item.initiative.id}`, item.initiative.name, [{ initiativeId: item.initiative.id, amount: item[metric]! }]))));
  return dashboardNode("root", "全体", [], nodes.filter(node => node.value > 0));
}

/** Account flows keep positive and negative entries separate before cancellation. */
export function buildDashboardFlows(contents: PlanContents, fiscalYear: number, direction: DashboardDirection): DashboardFlow[] {
  const names = new Map(contents.accounts.map(account => [account.id, account.accountName]));
  const expansions = new Map(contents.expansions.map(item => [item.id, item.expansionName]));
  const flows: DashboardFlow[] = [];
  for (const initiative of contents.initiatives) {
    if (initiative.fiscalYear !== fiscalYear) continue;
    const amounts = new Map<number, number>();
    for (const row of initiative.rows) {
      if (row.accountId === null) continue;
      for (const month of initiativeMonths) {
        const text = row.amounts[month];
        if (text === undefined || text === "") continue;
        const amount = Number(text);
        if (matchesDirection(amount, direction)) amounts.set(row.accountId, addAmounts(amounts.get(row.accountId) ?? 0, amount));
      }
    }
    for (const [accountId, amount] of amounts) flows.push({ initiativeId: initiative.id, initiative: initiative.name, expansionId: initiative.expansionId, accountId,
      expansion: initiative.expansionId === null ? "未選択" : expansions.get(initiative.expansionId) ?? "未選択",
      account: names.get(accountId) ?? "未選択", amount });
  }
  return flows;
}

/** A forest represents each account once; subtraction signs follow the whole path. */
export function buildAccountTree(contents: PlanContents, fiscalYear: number, direction: DashboardDirection): DashboardNode {
  const groups = new Map(contents.aggregations.map(group => [group.id, group]));
  const accounts = new Map(contents.accounts.map(account => [account.id, account]));
  const owners = new Set(contents.aggregations.flatMap(group => group.members.map(member => `${member.kind}:${member.id}`)));
  const yearly = contents.initiatives.filter(item => item.fiscalYear === fiscalYear);
  const visit = (kind: "account" | "group", id: number, sign: number, edgeSign = 1): DashboardNode => {
    if (kind === "account") {
      const contributions: Contribution[] = [];
      for (const initiative of yearly) for (const row of initiative.rows) {
        if (row.accountId !== id) continue;
        for (const month of initiativeMonths) {
          const text = row.amounts[month];
          if (text !== undefined && text !== "" && matchesDirection(Number(text) * sign, direction)) contributions.push({ initiativeId: initiative.id, amount: Number(text) * sign });
        }
      }
      return dashboardNode(`account:${id}`, `${edgeSign === -1 ? "− " : ""}${accounts.get(id)!.accountName}`, contributions);
    }
    const group = groups.get(id)!;
    return dashboardNode(`group:${id}`, `${edgeSign === -1 ? "− " : ""}${group.name}`, [],
      group.members.map(member => visit(member.kind, member.id, sign * member.sign, member.sign)).filter(node => node.value > 0));
  };
  const roots = contents.aggregations.filter(group => !owners.has(`group:${group.id}`)).map(group => visit("group", group.id, 1));
  const unassigned = contents.accounts.filter(account => !owners.has(`account:${account.id}`)).map(account => visit("account", account.id, 1));
  if (unassigned.some(node => node.value > 0)) roots.push(dashboardNode("unassigned", "未所属", [], unassigned.filter(node => node.value > 0)));
  return dashboardNode("root", "全体", [], roots.filter(node => node.value > 0));
}

export function monthContributions(impacts: DashboardImpact[], month: InitiativeMonth, metric: DashboardMetric): Contribution[] {
  return impacts.flatMap(({ initiative }) => {
    const amount = initiative.months[month]?.[metric];
    return amount === null || amount === undefined ? [] : [{ initiativeId: initiative.id, amount }];
  });
}
