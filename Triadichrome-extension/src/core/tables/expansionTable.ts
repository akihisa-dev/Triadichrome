import { addYen } from "../domain/amounts";
import { initiativeMonths } from "../domain/calendar";
import { type Initiative, type PlanContents } from "../domain/plan";

export type ExpansionSort = "registered" | "asc" | "desc";
export type ExpansionTotals = Record<number, { sales: number | null; profit: number | null }>;
const nameOrder = new Intl.Collator("ja", { numeric: true });

export function totalInitiatives(initiatives: Initiative[]): ExpansionTotals {
  return Object.fromEntries(initiativeMonths.map(month => {
    const values = initiatives.map(item => item.months[month]);
    const sum = (key: "sales" | "profit") => values.some(value => value?.[key] === null) ? null
      : values.reduce((total, value) => addYen(total, value?.[key] ?? 0), 0);
    return [month, { sales: sum("sales"), profit: sum("profit") }];
  }));
}

export function buildExpansionTable(contents: PlanContents, fiscalYear: number, sort: ExpansionSort) {
  const visible = contents.initiatives.filter(item => item.fiscalYear === fiscalYear);
  const members = new Map<number, Initiative[]>();
  for (const item of visible) {
    if (item.expansionId === null) continue;
    const group = members.get(item.expansionId) ?? [];
    group.push(item);
    members.set(item.expansionId, group);
  }
  const expansions = [...contents.expansions].sort((a, b) => a.expansionCode.length - b.expansionCode.length
    || (a.expansionCode < b.expansionCode ? -1 : a.expansionCode > b.expansionCode ? 1 : a.id - b.id));
  return {
    total: totalInitiatives(visible),
    groups: expansions.map(expansion => {
      const initiatives = members.get(expansion.id) ?? [];
      if (sort !== "registered") initiatives.sort((a, b) => nameOrder.compare(a.name, b.name) * (sort === "asc" ? 1 : -1));
      return { expansion, initiatives, total: totalInitiatives(initiatives) };
    }),
  };
}
