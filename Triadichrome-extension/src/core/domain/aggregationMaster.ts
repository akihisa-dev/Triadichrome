import type { Account } from "./accountMaster";
import { validateAggregations, type Aggregation, type AggregationMember } from "./aggregations";
export type AggregationChange =
  | { type: "add"; name: string }
  | { type: "update"; id: number; name: string; displayName?: string; members: AggregationMember[] }
  | { type: "move"; member: Pick<AggregationMember, "kind" | "id">; parentId: number | null; sign: 1 | -1 }
  | { type: "delete"; id: number };

export function changedAggregations(groups: Aggregation[], accounts: Account[], change: AggregationChange): Aggregation[] {
  let next: Aggregation[];
  if (change.type === "add") {
    next = [...groups, { id: Math.max(0, ...groups.map(group => group.id)) + 1, name: change.name.trim(), required: null, members: [] }];
  } else if (change.type === "move") {
    const { member, parentId, sign } = change;
    if (!(member.kind === "account" ? accounts : member.kind === "group" ? groups : []).some(item => item.id === member.id)) throw new Error("移動する科目・集計が見つかりません。");
    if (parentId !== null && !groups.some(group => group.id === parentId)) throw new Error("所属先の集計が見つかりません。");
    if (sign !== 1 && sign !== -1) throw new Error("加算または減算を選択してください。");
    // Remove and attach in one change: saving must never leave an item between parents.
    next = groups.map(group => {
      const members = group.members.filter(item => item.kind !== member.kind || item.id !== member.id);
      if (group.id === parentId) members.push({ ...member, sign });
      return { ...group, members };
    });
  } else {
    const current = groups.find(group => group.id === change.id);
    if (!current) throw new Error("集計が見つかりません。");
    if (change.type === "delete") {
      if (current.required) throw new Error("必須集計は削除できません。");
      if (current.members.length || groups.some(group => group.members.some(member => member.kind === "group" && member.id === current.id))) throw new Error("使用中の集計は削除できません。先に所属を解除してください。");
      next = groups.filter(group => group.id !== current.id);
    } else next = groups.map(group => group.id === current.id ? { ...group, name: change.name.trim(), ...(change.displayName === undefined ? {} : { displayName: change.displayName.trim() }), members: change.members } : group);
  }
  validateAggregations(next, new Set(accounts.map(account => account.id)));
  return next;
}
