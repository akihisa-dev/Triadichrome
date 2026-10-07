import { useLayoutEffect, useRef, type RefObject } from "react";
import { HomeMotion, motionLine, type MotionNode, type MotionEdge } from "../core/graph/homeMotion";
import type { RelationView } from "./useRelationCamera";

type Pull = { page: string; pointerId: number; x: number; y: number; startX: number; startY: number };

export function useHomeGraphMotion(nodes: readonly MotionNode[], edges: readonly MotionEdge[], view: RefObject<RelationView | null>, onLayout?: () => void) {
  const groups = useRef(new Map<string, SVGGElement>());
  const paths = useRef(new Map<number, SVGPathElement>());
  const pull = useRef<Pull | null>(null);
  const simulation = useRef<HomeMotion | null>(null);
  const wake = useRef(() => {});
  const paint = useRef(() => {});
  const layout = useRef(onLayout);
  layout.current = onLayout;

  useLayoutEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = new HomeMotion(nodes, edges, view.current?.positions);
    simulation.current = motion;
    for (const node of nodes) {
      const label = groups.current.get(node.page)?.querySelector<HTMLElement>(".home-relation-name");
      if (label) motion.bodies.get(node.page)!.width = Math.max(40, label.offsetWidth);
    }
    paint.current = () => {
      for (const node of nodes) {
        const body = motion.bodies.get(node.page)!;
        groups.current.get(node.page)?.setAttribute("transform", `translate(${body.x - node.x - 100} ${body.y - node.y - 12})`);
      }
      edges.forEach((edge, index) => paths.current.get(index)?.setAttribute("d", motionLine(motion.bodies.get(edge.from)!, motion.bodies.get(edge.to)!)));
      if (view.current) view.current.positions = motion.positions();
      layout.current?.();
    };
    let frame = 0, previous = 0;
    const animate = (time: number) => {
      motion.advance(previous ? (time - previous) / 1000 : 1 / 60, preference.matches);
      previous = time;
      paint.current();
      frame = motion.active ? requestAnimationFrame(animate) : 0;
    };
    wake.current = () => { if (!frame) { previous = 0; frame = requestAnimationFrame(animate); } };
    paint.current();
    wake.current();
    return () => { cancelAnimationFrame(frame); simulation.current = null; wake.current = paint.current = () => {}; };
  }, [nodes, edges, view]);

  return {
    groups, paths, pull,
    begin(page: string, pointerId: number, x: number, y: number) {
      const body = simulation.current?.bodies.get(page);
      if (!body) return;
      simulation.current!.hold(page);
      if (view.current) view.current.fitted = false;
      pull.current = { page, pointerId, x, y, startX: body.x, startY: body.y };
    },
    move(x: number, y: number, scale: number) {
      const current = pull.current;
      if (!current) return;
      simulation.current?.move(current.startX + (x - current.x) / scale, current.startY + (y - current.y) / scale);
      if (view.current) view.current.fitted = false;
      // Position and both line endpoints share the pointer update, without a React/frame delay.
      paint.current();
      wake.current();
    },
    release() { simulation.current?.release(); pull.current = null; wake.current(); },
  };
}
