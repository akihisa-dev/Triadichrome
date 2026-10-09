export const requiredAggregations = {
  sales: "売上集計", expenses: "費用集計", operating: "営業利益", ordinary: "経常利益",
} as const;
export type RequiredAggregation = keyof typeof requiredAggregations;
export type AggregationMember = { kind: "account" | "group"; id: number; sign: 1 | -1 };
export type Aggregation = { id: number; name: string; required: RequiredAggregation | null; displayName?: string; masterOrder?: number; members: AggregationMember[] };

export function initialAggregations(): Aggregation[] {
  return Object.entries(requiredAggregations).map(([required, name], index) => ({
    id: index + 1, name, required: required as RequiredAggregation, members: [],
  }));
}

/** A single parent per item prevents both direct and indirect double counting. */
export function validateAggregations(groups: Aggregation[], accountIds: Set<number>): void {
  const byId = new Map(groups.map(group => [group.id, group]));
  if (byId.size !== groups.length) throw new Error("集計が重複しています。");
  const names = new Set<string>();
  const owners = new Map<string, number>();
  for (const [key, name] of Object.entries(requiredAggregations)) {
    const matches = groups.filter(group => group.required === key);
    if (matches.length !== 1 || matches[0]!.name !== name) throw new Error(`必須集計「${name}」は削除・改名できません。`);
  }
  for (const group of groups) {
    if (group.required !== null && !Object.hasOwn(requiredAggregations, group.required)) throw new Error("必須集計の種類が正しくありません。");
    if (!group.name.trim()) throw new Error("集計名を入力してください。");
    if (group.displayName !== undefined && !group.displayName.trim()) throw new Error("表示名を入力してください。");
    if (names.has(group.name.trim())) throw new Error("同じ名前の集計が登録されています。");
    names.add(group.name.trim());
    for (const member of group.members) {
      if (member.sign !== 1 && member.sign !== -1) throw new Error("加算または減算を選択してください。");
      if (member.kind === "account" ? !accountIds.has(member.id) : member.kind !== "group" || !byId.has(member.id)) throw new Error("集計対象が見つかりません。");
      const key = `${member.kind}:${member.id}`;
      if (owners.has(key)) throw new Error("同じ科目・集計を重複して所属させることはできません。");
      owners.set(key, group.id);
    }
  }
  const done = new Set<number>();
  for (const group of groups) {
    const path = new Set<number>();
    let id: number | undefined = group.id;
    while (id !== undefined && !done.has(id)) {
      if (path.has(id)) throw new Error("集計の所属が循環しています。自分自身や親の集計を含めることはできません。");
      path.add(id);
      id = owners.get(`group:${id}`);
    }
    for (const visited of path) done.add(visited);
  }
}
