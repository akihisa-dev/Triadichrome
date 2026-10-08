import { checkedYen } from "../domain/amounts";
import { initiativeMonths } from "../domain/calendar";
import type { Initiative } from "../domain/plan";

/** Sum original integer yen; a missing account attribute remains unresolved. */
export function initiativeTotals(initiatives: Initiative[]): Initiative["months"] {
  return Object.fromEntries(initiativeMonths.map(month => {
    const sum = (key: "sales" | "expense" | "profit") => {
      let total = 0n;
      let unresolved = false;
      for (const item of initiatives) {
        const value = item.months[month]?.[key];
        if (value === null) { unresolved = true; continue; }
        if (value === undefined) continue;
        if (!Number.isSafeInteger(value)) throw new Error("金額が正確に計算できる範囲を超えています。");
        total += BigInt(value);
      }
      return unresolved ? null : checkedYen(total);
    };
    return [month, { sales: sum("sales"), expense: sum("expense")!, profit: sum("profit") }];
  }));
}
