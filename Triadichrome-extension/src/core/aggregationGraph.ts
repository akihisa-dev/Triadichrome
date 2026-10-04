import { type Aggregation } from "./aggregations";

export const aggregationNodeWidth = 224;
const columnGap = 48;
const rowGap = 148; // Drop targets sit below each parent, before the connecting branches.
export type GraphNode = { id: number; x: number; y: number; height: number };

/** A single-parent forest with each result above its contributing groups. */
export function layoutAggregationGraph(groups: Aggregation[], heights: ReadonlyMap<number, number>, availableWidth = 640) {
  const children = new Map(groups.map(group => [group.id, group.members.filter(member => member.kind === "group").map(member => member.id)]));
  const owned = new Set([...children.values()].flat());
  const roots = groups.filter(group => !owned.has(group.id));
  const spans = new Map<number, number>();
  const height = (id: number) => heights.get(id) ?? 100;
  // Iterative postorder also supports deeply nested imported plans.
  const queue = [...roots.map(group => group.id)];
  for (let index = 0; index < queue.length; index++) queue.push(...(children.get(queue[index]!) ?? []));
  for (let index = queue.length - 1; index >= 0; index--) {
    const id = queue[index]!;
    const childIds = children.get(id)!;
    spans.set(id, Math.max(aggregationNodeWidth, childIds.reduce((sum, child) => sum + spans.get(child)!, 0) + Math.max(0, childIds.length - 1) * columnGap));
  }
  const nodes: GraphNode[] = [];
  let top = 32;
  let left = 20;
  let rowHeight = 0;
  for (const root of roots) {
    const componentWidth = spans.get(root.id)!;
    if (left > 20 && left + componentWidth + 20 > availableWidth) { top += rowHeight + rowGap; left = 20; rowHeight = 0; }
    const placements = [{ id: root.id, left, depth: 0 }];
    const levelHeights: number[] = [];
    for (let index = 0; index < placements.length; index++) {
      const placement = placements[index]!;
      const span = spans.get(placement.id)!;
      levelHeights[placement.depth] = Math.max(levelHeights[placement.depth] ?? 0, height(placement.id));
      const childIds = children.get(placement.id)!;
      const childSpan = childIds.reduce((sum, child) => sum + spans.get(child)!, 0) + Math.max(0, childIds.length - 1) * columnGap;
      let childLeft = placement.left + (span - childSpan) / 2;
      for (const child of childIds) {
        placements.push({ id: child, left: childLeft, depth: placement.depth + 1 });
        childLeft += spans.get(child)! + columnGap;
      }
    }
    const levelTops = [top];
    for (let depth = 1; depth < levelHeights.length; depth++) levelTops.push(levelTops[depth - 1]! + levelHeights[depth - 1]! + rowGap);
    for (const placement of placements) nodes.push({ id: placement.id, x: placement.left + (spans.get(placement.id)! - aggregationNodeWidth) / 2, y: levelTops[placement.depth]!, height: height(placement.id) });
    rowHeight = Math.max(rowHeight, levelTops.at(-1)! - top + levelHeights.at(-1)!);
    left += componentWidth + columnGap;
  }
  return { nodes, width: nodes.reduce((maximum, node) => Math.max(maximum, node.x + aggregationNodeWidth + 20), 0), height: Math.max(300, top + rowHeight + rowGap) };
}
