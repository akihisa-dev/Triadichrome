import type { Aggregation } from "./aggregations";

/** Child-first order for a validated single-parent forest.
 * Leaves retain input order; a parent follows its last completed child.
 * Keep traversal iterative so nesting does not consume the call stack.
 */
export function childFirstAggregations(groups: readonly Aggregation[]): Aggregation[] {
  const pending = new Map<number, number>();
  const parents = new Map<number, Aggregation>();
  const queue: Aggregation[] = [];
  for (const group of groups) {
    const children = group.members.filter(member => member.kind === "group");
    pending.set(group.id, children.length);
    for (const child of children) parents.set(child.id, group);
    if (!children.length) queue.push(group);
  }
  for (let index = 0; index < queue.length; index++) {
    const parent = parents.get(queue[index]!.id);
    if (!parent) continue;
    const remaining = pending.get(parent.id)! - 1;
    pending.set(parent.id, remaining);
    if (!remaining) queue.push(parent);
  }
  return queue;
}
