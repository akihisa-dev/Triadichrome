import { accountEffectsYen } from "../domain/accountEffects";
import { amountToYen, checkedYen } from "../domain/amounts";
import { resolvedAmount, type KindId } from "../domain/kinds";
import { initiativeMonths } from "../domain/calendar";
import type { Initiative } from "../domain/plan";
import type { Account } from "../domain/accountMaster";
/** Resolve a kind once and pass the same projected values to all tables. */
export function initiativesForKind(initiatives: Initiative[], accounts: Account[], kind: KindId): Initiative[] {
  const attributes = new Map(accounts.map(account => [account.id, account.accountType]));
  return initiatives.map(initiative => {
    const rows = initiative.rows.map(row => ({ ...row, amounts: Object.fromEntries(initiativeMonths.map(month => [month, resolvedAmount(row, kind, month)])) }));
    const months: Initiative["months"] = {};
    for (const month of initiativeMonths) {
      let salesYen = 0n, expenseYen = 0n, profitYen = 0n;
      for (const row of rows) {
        const attribute = row.accountId === null ? null : attributes.get(row.accountId);
        const effects = accountEffectsYen(amountToYen(row.amounts[month] || "0"), attribute);
        salesYen += BigInt(effects.sales); expenseYen += BigInt(effects.expense); profitYen += BigInt(effects.profit);
      }
      months[month] = { sales: checkedYen(salesYen), expense: checkedYen(expenseYen), profit: checkedYen(profitYen) };
    }
    return { ...initiative, rows, months };
  });
}
