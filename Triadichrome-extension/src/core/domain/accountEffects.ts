import { yenToAmount } from "./amounts";
export function accountEffectsYen(yen: number, attribute: string | null | undefined) {
  return { sales: attribute === "sales" ? yen : attribute === "cost" ? -yen : 0,
    expense: attribute === "expense" ? yen : 0,
    profit: attribute === "sales" || attribute === "profit" ? yen : attribute === "cost" || attribute === "expense" ? -yen : 0 };
}
export function accountEffects(yen: number, attribute: string | null | undefined) {
  const values = accountEffectsYen(yen, attribute);
  return { sales: yenToAmount(values.sales), profit: yenToAmount(values.profit) };
}
