import type { Account } from "./accountMaster";
import type { Aggregation } from "./aggregations";
import { childFirstAggregations } from "./aggregationOrder";
export type MasterRow = { kind: "account" | "group"; id: number };
export const masterRowKey = (row: MasterRow) => `${row.kind}:${row.id}`;
export function validateMasterOrder(order: MasterRow[], accounts: Account[], groups: Aggregation[]): void {
  const keys = new Set([...accounts.map(item => `account:${item.id}`), ...groups.map(item => `group:${item.id}`)]);
  if (order.length !== keys.size || order.some(row => !keys.delete(masterRowKey(row))) || keys.size) throw new Error("並べ替える科目・集計が一致しません。");
}
/** Saved masters use their sole persisted order. New in-memory definitions derive their initial placement from members. */
export function orderedMasterRows(accounts: Account[], groups: Aggregation[]): MasterRow[] {
  const all = [...accounts.map(item => ({ kind: "account" as const, id: item.id, rank: item.masterOrder })), ...groups.map(item => ({ kind: "group" as const, id: item.id, rank: item.masterOrder }))];
  if (all.every(item => item.rank !== undefined)) return all.sort((a,b) => a.rank! - b.rank!).map(({kind,id}) => ({kind,id}));
  const positions = new Map(accounts.map((item,index) => [`account:${item.id}`, index]));
  const sorted: {id: number; position: number}[] = [];
  for (const group of childFirstAggregations(groups)) {
    const position = Math.max(-1, ...group.members.map(member => positions.get(masterRowKey(member)) ?? -1));
    const effective = position < 0 ? accounts.length - 1 : position;
    positions.set(`group:${group.id}`, effective); sorted.push({id:group.id, position:effective});
  }
  sorted.sort((a,b) => a.position - b.position);
  const output: MasterRow[] = []; let cursor = 0;
  for (const [index,account] of accounts.entries()) {
    output.push({kind:"account",id:account.id});
    while (cursor < sorted.length && sorted[cursor]!.position === index) output.push({kind:"group",id:sorted[cursor++]!.id});
  }
  output.push(...sorted.slice(cursor).map(item => ({kind:"group" as const,id:item.id})));
  return output;
}
