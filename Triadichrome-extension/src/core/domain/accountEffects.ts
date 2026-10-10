import { yenToAmount } from "./amounts";
import { amountItemEffectsYen } from "./amountItems";
export function accountEffectsYen(yen: number, attribute: string | null | undefined) {
  return amountItemEffectsYen(yen, attribute);
}
export function accountEffects(yen: number, attribute: string | null | undefined) {
  const values = accountEffectsYen(yen, attribute);
  return { sales: yenToAmount(values.sales), profit: yenToAmount(values.profit) };
}
