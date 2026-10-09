import { amountToYen, yenToAmount } from "../domain/amounts";
/** Excel keeps 15 significant decimal digits; preserve other amounts as text. */
export function excelAmount(amount: string): number | string {
  const yen = amountToYen(amount);
  const normalized = yenToAmount(yen);
  const digits = String(Math.abs(yen)).replace(/0+$/, "");
  const numeric = Number(normalized);
  if (digits.length <= 15 && amountToYen(String(numeric)) === yen) return numeric;
  return normalized;
}
