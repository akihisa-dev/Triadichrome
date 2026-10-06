import { useLayoutEffect, useRef, type RefObject } from "react";
import type { RelationView } from "./useRelationCamera";

type Offset = { x: number; y: number; vx: number; vy: number };
type Pull = { page: string; pointerId: number; x: number; y: number; startX: number; startY: number };
type Node = { page: string; x: number; y: number; width?: number; height?: number; sub?: boolean };
type Edge = { from: string; to: string };

// Graph forces run independently of React; neither dragging nor links restore a node's original position.
export function useHomeGraphMotion(nodes: readonly Node[], edges: readonly Edge[], view: RefObject<RelationView | null>) {
  const groups = useRef(new Map<string, SVGGElement>());
  const paths = useRef(new Map<number, SVGPathElement>());
  const offsets = useRef(new Map<string, Offset>());
  const pull = useRef<Pull | null>(null);
  const wake = useRef(() => {});
  const heat = useRef(view.current?.positions ? 0 : 1);
  const offset = (node: Node) => {
    let value = offsets.current.get(node.page);
    if (!value) {
      const saved = view.current?.positions?.[node.page];
      value = { x: saved ? saved.x - node.x - 100 : 0, y: saved ? saved.y - node.y - 12 : 0, vx: 0, vy: 0 };
      offsets.current.set(node.page, value);
    }
    return value;
  };

  useLayoutEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const byPage = new Map(nodes.map(node => [node.page, node]));
    const neighbors = new Map(nodes.map(node => [node.page, edges.flatMap(edge => edge.from === node.page ? [edge.to] : edge.to === node.page ? [edge.from] : [])]));
    let frame = 0, previous = 0;
    const animate = (time: number) => {
      const dt = Math.min(.025, previous ? (time - previous) / 1000 : 1 / 60);
      previous = time;
      const reduced = preference.matches;
      const positions = new Map(nodes.map(node => { const value = offset(node); return [node.page, { x: node.x + 100 + value.x, y: node.y + 12 + value.y }]; }));
      nodes.forEach(node => {
        const value = offset(node), position = positions.get(node.page)!;
        if (pull.current?.page !== node.page && !groups.current.get(node.page)?.matches(":hover, :focus-within") && heat.current > .001) {
          let forceX = (620 - position.x) * .3, forceY = (320 - position.y) * .3;
          for (const page of neighbors.get(node.page)!) {
            const other = positions.get(page)!;
            const dx = other.x - position.x, dy = other.y - position.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const strength = (distance - 180) * 4;
            forceX += dx / distance * strength;
            forceY += dy / distance * strength;
          }
          for (const other of nodes) {
            if (other.page === node.page) continue;
            const neighbor = positions.get(other.page)!;
            const dx = position.x - neighbor.x, dy = position.y - neighbor.y;
            const distance = Math.max(24, Math.hypot(dx, dy));
            const strength = 1200000 / (distance * distance);
            forceX += dx / distance * strength;
            forceY += dy / distance * strength;
            const collisionDy = dy + (node.sub ? 0 : 24) - (other.sub ? 0 : 24);
            const overlapX = ((node.width ?? 200) + (other.width ?? 200)) / 2 + 12 - Math.abs(dx), overlapY = ((node.height ?? 72) + (other.height ?? 72)) / 2 + 12 - Math.abs(collisionDy);
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY) forceX += Math.sign(dx || 1) * overlapX * 60;
              else forceY += Math.sign(collisionDy || 1) * overlapY * 60;
            }
          }
          value.vx = (value.vx + forceX * heat.current * dt) * Math.exp(-(reduced ? 16 : 7) * dt);
          value.vy = (value.vy + forceY * heat.current * dt) * Math.exp(-(reduced ? 16 : 7) * dt);
          value.x += value.vx * dt;
          value.y += value.vy * dt;
        }
        groups.current.get(node.page)?.setAttribute("transform", `translate(${value.x} ${value.y})`);
      });
      edges.forEach((edge, index) => {
        const from = byPage.get(edge.from)!, to = byPage.get(edge.to)!;
        const a = offset(from), b = offset(to);
        const x1 = from.x + 100 + a.x, y1 = from.y + 12 + a.y;
        const x2 = to.x + 100 + b.x, y2 = to.y + 12 + b.y;
        const dx = x2 - x1, dy = y2 - y1, distance = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / distance, uy = dy / distance;
        const inset = (node: Node) => node.sub ? Math.min((node.width ?? 112) / 2 / Math.max(.01, Math.abs(ux)), 16 / Math.max(.01, Math.abs(uy))) : 16;
        const start = inset(from), end = inset(to);
        paths.current.get(index)?.setAttribute("d", `M${x1 + ux * start} ${y1 + uy * start} L${x2 - ux * end} ${y2 - uy * end}`);
      });
      if (view.current) {
        view.current.positions = Object.fromEntries(nodes.map(node => { const value = offset(node); return [node.page, { x: node.x + 100 + value.x, y: node.y + 12 + value.y }]; }));
      }
      if (!pull.current) heat.current *= Math.exp(-dt * (reduced ? 1.4 : .5));
      frame = heat.current > .001 || pull.current ? requestAnimationFrame(animate) : 0;
    };
    wake.current = () => { if (!frame) { previous = 0; frame = requestAnimationFrame(animate); } };
    wake.current();
    return () => { cancelAnimationFrame(frame); wake.current = () => {}; };
  }, [nodes, edges, view]);

  return {
    groups, paths, pull,
    begin(page: string, pointerId: number, x: number, y: number) {
      const value = offset(nodes.find(node => node.page === page)!);
      value.vx = value.vy = 0;
      pull.current = { page, pointerId, x, y, startX: value.x, startY: value.y };
      heat.current = 1;
      wake.current();
    },
    move(x: number, y: number, scale: number) {
      const current = pull.current;
      if (!current) return;
      const value = offset(nodes.find(node => node.page === current.page)!);
      value.x = current.startX + (x - current.x) / scale;
      value.y = current.startY + (y - current.y) / scale;
      heat.current = 1;
    },
    release() { pull.current = null; },
  };
}
