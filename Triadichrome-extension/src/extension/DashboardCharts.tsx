import { partitionDashboardRects } from "../core/dashboardLayout";
import type { KeyboardEvent, ReactNode } from "react";
import type { DashboardFlow, DashboardNode } from "../core/dashboard";
import { addAmounts, formatAmount } from "../core/amounts";

export const chartShade = (index: number) => ["#333333", "#595959", "#808080", "#a0a0a0", "#b8b8b8", "#d0d0d0"][index % 6]!;
const polar = (radius: number, angle: number) => [250 + radius * Math.sin(angle), 165 - radius * Math.cos(angle)];
export function arcPath(inner: number, outer: number, start: number, end: number): string {
  const finish = Math.min(end, start + Math.PI * 2 - 0.00001);
  const a = polar(outer, start), b = polar(outer, finish), c = polar(inner, finish), d = polar(inner, start);
  const large = finish - start > Math.PI ? 1 : 0;
  if (inner === 0) return `M250,165 L${a} A${outer},${outer} 0 ${large} 1 ${b} Z`;
  return `M${a} A${outer},${outer} 0 ${large} 1 ${b} L${c} A${inner},${inner} 0 ${large} 0 ${d} Z`;
}
function activate(event: KeyboardEvent<SVGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
}
function Mark({ label, selected, onPick, children }: { label: string; selected: boolean; onPick: () => void; children: ReactNode }) {
  return <g className={`dashboard-mark${selected ? " is-selected" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
    onClick={onPick} onKeyDown={event => activate(event, onPick)}><title>{label}</title>{children}</g>;
}
function Legend({ nodes, selected, onPick }: { nodes: DashboardNode[]; selected: string | undefined; onPick: (node: DashboardNode) => void }) {
  return <div className="dashboard-legend">{nodes.map((node, index) => <button type="button" key={node.key} aria-pressed={selected === node.key} onClick={() => onPick(node)}>
    <i style={{ background: chartShade(index) }} aria-hidden="true" /><span>{node.name}</span><strong>{formatAmount(node.value)}</strong>
  </button>)}</div>;
}
export function SunburstChart({ root, selected, onPick }: { root: DashboardNode; selected?: string | undefined; onPick: (node: DashboardNode) => void }) {
  const segments: { node: DashboardNode; start: number; end: number; depth: number; shade: number }[] = [];
  let deepest = 1;
  const walk = (node: DashboardNode, start: number, end: number, depth: number, shade: number) => {
    let cursor = start;
    node.children.forEach((child, index) => {
      const next = cursor + (end - start) * child.value / node.value;
      const color = depth === 1 ? index : shade;
      segments.push({ node: child, start: cursor, end: next, depth, shade: color }); deepest = Math.max(deepest, depth);
      walk(child, cursor, next, depth + 1, color); cursor = next;
    });
  };
  walk(root, 0, Math.PI * 2, 1, 0);
  const width = 118 / deepest;
  return <><svg className="dashboard-svg" viewBox="0 0 500 330" aria-label="集計と科目のサンバースト図">
    {segments.map(item => <Mark key={item.node.key} label={`${item.node.name} ${formatAmount(item.node.value)}千円`} selected={selected === item.node.key} onPick={() => onPick(item.node)}>
      <path d={arcPath(32 + (item.depth - 1) * width, 32 + item.depth * width, item.start, item.end)} fill={chartShade(item.shade)} stroke="white" strokeWidth="1.5" />
    </Mark>)}
    <text x="250" y="164" textAnchor="middle" className="dashboard-svg-label">内訳</text>
  </svg><Legend nodes={root.children} selected={selected} onPick={onPick} /></>;
}
export function TreemapChart({ root, selected, onPick }: { root: DashboardNode; selected?: string | undefined; onPick: (node: DashboardNode) => void }) {
  return <><svg className="dashboard-svg" viewBox="0 0 500 330" aria-label="展開区分と施策のツリーマップ">
    {partitionDashboardRects(root.children, 0, 0, 500, 330).map(({ node: group, x, y, width, height }) => {
      const index = root.children.findIndex(node => node.key === group.key);
      const header = Math.min(26, height * 0.18);
      return <g key={group.key}>
        <Mark label={`${group.name} ${formatAmount(group.value)}千円`} selected={selected === group.key} onPick={() => onPick(group)}>
          <rect x={x} y={y} width={width} height={header} fill={chartShade(index)} stroke="white" />
          {width > 45 && header > 15 && <text x={x + 8} y={y + header - 7} fill={index % 6 < 3 ? "white" : "#222"}>{group.name}</text>}
        </Mark>
        {partitionDashboardRects(group.children, x, y + header, width, height - header).map(({ node: child, x: left, y: top, width: w, height: h }) => {
          const limit = Math.max(3, Math.floor(w / 13) - 1);
          return <Mark key={child.key} label={`${child.name} ${formatAmount(child.value)}千円`} selected={selected === child.key || selected === group.key} onPick={() => onPick(child)}>
            <rect x={left} y={top} width={w} height={h} fill={chartShade(index)} stroke="white" strokeWidth="2" />
            {w > 65 && h > 38 && <text x={left + w / 2} y={top + h / 2} textAnchor="middle" fill={index % 6 < 3 ? "white" : "#222"}>{child.name.slice(0, limit)}{child.name.length > limit ? "…" : ""}</text>}
          </Mark>;
        })}
      </g>;
    })}
  </svg><Legend nodes={root.children} selected={selected} onPick={onPick} /></>;
}
export function PieChart({ root, selected, onPick }: { root: DashboardNode; selected?: string | undefined; onPick: (node: DashboardNode) => void }) {
  let start = 0;
  return <><svg className="dashboard-svg" viewBox="0 0 500 330" aria-label="部署別の円グラフ">
    {root.children.map((node, index) => {
      const end = start + node.value / root.value * Math.PI * 2; const beginning = start; start = end;
      const [x, y] = polar(94, (beginning + end) / 2);
      return <Mark key={node.key} label={`${node.name} ${formatAmount(node.value)}千円 ${Math.round(node.value / root.value * 100)}%`} selected={selected === node.key} onPick={() => onPick(node)}>
        <path d={arcPath(0, 148, beginning, end)} fill={chartShade(index)} stroke="white" strokeWidth="2" />
        {node.value / root.value > 0.06 && <text x={x} y={y} textAnchor="middle" fill={index % 6 < 3 ? "white" : "#222"}>{Math.round(node.value / root.value * 100)}%</text>}
      </Mark>;
    })}
  </svg><Legend nodes={root.children} selected={selected} onPick={onPick} /></>;
}

export function SankeyChart({ flows, selected, onPick }: { flows: DashboardFlow[]; selected?: string | undefined; onPick: (key: string) => void }) {
  const columns = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const keys = (flow: DashboardFlow) => [`expansion:${flow.expansionId}`, `initiative:${flow.initiativeId}`, `account:${flow.accountId}`];
  const names = new Map<string, string>();
  for (const flow of flows) keys(flow).forEach((key, column) => {
    const totals = columns[column]!; totals.set(key, addAmounts(totals.get(key) ?? 0, Math.abs(flow.amount)));
    names.set(key, [flow.expansion, flow.initiative, flow.account][column]!);
  });
  const total = [...columns[0]!.values()].reduce(addAmounts, 0);
  const height = Math.max(300, Math.max(...columns.map(column => column.size)) * 24);
  const scale = (height - Math.max(...columns.map(column => column.size)) * 10) / total;
  const positions = columns.map(column => {
    let y = 30;
    return new Map([...column].map(([key, value]) => { const top = y; y += value * scale + 10; return [key, top]; }));
  });
  const offsets = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const take = (column: number, key: string, width: number, side: number) => {
    const map = offsets[side]!; const start = positions[column]!.get(key)! + (map.get(key) ?? 0);
    map.set(key, (map.get(key) ?? 0) + width); return start;
  };
  return <svg className="dashboard-svg dashboard-sankey" viewBox={`0 0 500 ${height + 60}`} aria-label="展開区分から施策、勘定科目へのサンキーチャート">
    {["展開区分", "施策", "勘定科目"].map((name, index) => <text key={name} x={16 + index * 226} y="16" textAnchor={index === 2 ? "end" : "start"}>{name}</text>)}
    {flows.flatMap((flow, index) => {
      const nodes = keys(flow); const width = Math.abs(flow.amount) * scale;
      return [0, 1].map(column => {
        const from = take(column, nodes[column]!, width, column === 0 ? 0 : 2);
        const to = take(column + 1, nodes[column + 1]!, width, column === 0 ? 1 : 3);
        const x1 = 26 + column * 226, x2 = 242 + column * 226;
        return <Mark key={`${index}:${column}`} label={`${flow.expansion} → ${flow.initiative} → ${flow.account} ${formatAmount(flow.amount)}千円`} selected={selected !== undefined && nodes.includes(selected)} onPick={() => onPick(nodes[1]!)}>
          <path d={`M${x1},${from} C${x1 + 80},${from} ${x2 - 80},${to} ${x2},${to} L${x2},${to + width} C${x2 - 80},${to + width} ${x1 + 80},${from + width} ${x1},${from + width} Z`} fill={chartShade(index)} opacity="0.5" />
        </Mark>;
      });
    })}
    {columns.flatMap((column, index) => [...column].map(([key, value]) => <Mark key={`${index}:${key}`} label={`${names.get(key)} ${formatAmount(value)}千円`} selected={selected === key} onPick={() => onPick(key)}>
      <rect x={16 + index * 226} y={positions[index]!.get(key)} width="10" height={value * scale} fill="#333" />
      <text x={index === 2 ? 461 : 30 + index * 226} y={positions[index]!.get(key)! + Math.min(value * scale / 2 + 4, 15)} textAnchor={index === 2 ? "end" : "start"} className="dashboard-flow-label">{names.get(key)!.slice(0, 12)}</text>
    </Mark>))}
  </svg>;
}
