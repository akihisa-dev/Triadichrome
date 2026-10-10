import { accountTypes, type AccountType } from "./accountTypes";

type Component = { readonly attribute: AccountType; readonly sign: 1 | -1 };
type AmountItem = { readonly id: "sales" | "expense" | "profit"; readonly name: string; readonly components: readonly Component[] };

/** Fixed business definitions shared by the master and monetary calculations. */
export const amountItems = [
  { id: "sales", name: "売上", components: [{ attribute: "sales", sign: 1 }, { attribute: "cost", sign: -1 }] },
  { id: "expense", name: "費用", components: [{ attribute: "expense", sign: 1 }] },
  { id: "profit", name: "利益", components: [{ attribute: "sales", sign: 1 }, { attribute: "cost", sign: -1 }, { attribute: "expense", sign: -1 }, { attribute: "profit", sign: 1 }] },
] as const satisfies readonly AmountItem[];

export function amountItemComposition(item: AmountItem): string {
  return item.components.map((component, index) => `${index === 0 ? (component.sign === -1 ? "−" : "") : component.sign === 1 ? " ＋ " : " − "}${accountTypes[component.attribute]}`).join("");
}

const effects = Object.fromEntries(Object.keys(accountTypes).map(attribute => [attribute,
  Object.fromEntries(amountItems.map(item => [item.id, (item.components as readonly Component[]).find(component => component.attribute === attribute)?.sign ?? 0])) as Record<AmountItem["id"], number>,
]));

export function amountItemEffectsYen(yen: number, attribute: string | null | undefined) {
  const effect = attribute && Object.hasOwn(effects, attribute) ? effects[attribute] : undefined;
  return { sales: effect?.sales ? yen * effect.sales : 0, expense: effect?.expense ? yen * effect.expense : 0, profit: effect?.profit ? yen * effect.profit : 0 };
}
