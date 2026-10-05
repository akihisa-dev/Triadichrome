import type { DashboardNode } from "./dashboard";
export type DashboardRect = { node: DashboardNode; x: number; y: number; width: number; height: number };

/** Balanced binary partitions keep exact area proportions without thin full-height strips. */
export function partitionDashboardRects(nodes: DashboardNode[], x: number, y: number, width: number, height: number): DashboardRect[] {
  const items = nodes.filter(node => node.value > 0).slice().sort((a, b) => b.value - a.value);
  if (items.length === 0) return [];
  if (items.length === 1) return [{ node: items[0]!, x, y, width, height }];
  const total = items.reduce((sum, node) => sum + node.value, 0);
  let subtotal = items[0]!.value, split = 1;
  while (split < items.length - 1 && Math.abs(subtotal + items[split]!.value - total / 2) < Math.abs(subtotal - total / 2)) subtotal += items[split++]!.value;
  const fraction = subtotal / total;
  if (width >= height) return [...partitionDashboardRects(items.slice(0, split), x, y, width * fraction, height),
    ...partitionDashboardRects(items.slice(split), x + width * fraction, y, width * (1 - fraction), height)];
  return [...partitionDashboardRects(items.slice(0, split), x, y, width, height * fraction),
    ...partitionDashboardRects(items.slice(split), x, y + height * fraction, width, height * (1 - fraction))];
}
