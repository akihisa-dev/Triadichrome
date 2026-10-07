import { amountToYen } from "../domain/amounts";
import { accountEffects } from "../domain/accountEffects";
import { calendarYear, initiativeMonths } from "../domain/calendar";
import { INITIAL_KINDS, kindIds, resolvedAmount } from "../domain/kinds";
import type { PlanContents } from "../domain/plan";
import { detailKey, type DetailTarget, type DetailRecord } from "../domain/details";
/** All detail views are derived from the same loaded plan, without opening SQLite. */
export function buildDetails(contents: PlanContents): DetailRecord[] {
  const accounts = new Map(contents.accounts.map((account, order) => [account.id, { ...account, order }]));
  const result: DetailRecord[] = [];
  const { fiscalYear } = contents;
  for (const item of contents.previousAmounts) {
    const account = accounts.get(item.accountId)!;
    const target: DetailTarget = { source: "previous", previousId: item.id, revision: item.revision };
    result.push({ ...target, id: detailKey(target), rowId: `previous:${item.id}`, initiativeId: 0, kindId: 0, month: item.month, initiativeRevision: 0, rowRevision: 0,
      kindName: "前年", initiativeName: "前年", note: "", fiscalYear, year: calendarYear(fiscalYear, item.month),
      expansionId: null, industryId: item.industryId, departmentId: item.departmentId, periodTypeId: null,
      accountId: account.id, accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType,
      amount: item.amount, ...accountEffects(amountToYen(item.amount), account.accountType), initiativeOrder: -1, rowOrder: account.order });
  }
  for (const [initiativeOrder, initiative] of contents.initiatives.entries()) {
    for (const [rowOrder, row] of initiative.rows.entries()) {
      const account = accounts.get(row.accountId!)!;
      for (const month of initiativeMonths) for (const kindId of kindIds) {
        const amount = resolvedAmount(row, kindId, month);
        const target: DetailTarget = { source: "initiative", rowId: row.id!, initiativeId: initiative.id, kindId, month,
          initiativeRevision: initiative.revision, rowRevision: row.revision ?? 0,
          revision: kindId === 1 || row.overrides?.[2]?.[month] === undefined ? row.amountRevisions?.[month] ?? 0 : row.overrideRevisions?.[month] ?? 0 };
        result.push({ ...target, id: detailKey(target), kindName: INITIAL_KINDS.find(kind => kind.id === kindId)!.kindName,
          industryId: initiative.industryId ?? null, departmentId: initiative.departmentId ?? null, periodTypeId: initiative.periodTypeId ?? null,
          initiativeName: initiative.name, note: initiative.note, fiscalYear, year: calendarYear(fiscalYear, month), expansionId: initiative.expansionId,
          accountId: account.id, accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType,
          amount, ...accountEffects(amountToYen(amount), account.accountType), initiativeOrder, rowOrder });
      }
    }
  }
  return result.sort((a,b) => a.initiativeOrder - b.initiativeOrder || a.initiativeId - b.initiativeId || a.rowOrder - b.rowOrder
    || (a.kindId === 0 ? a.industryId! - b.industryId! || a.departmentId! - b.departmentId! : 0)
    || ((a.month + 8) % 12) - ((b.month + 8) % 12) || a.kindId - b.kindId || a.id.localeCompare(b.id));
}
