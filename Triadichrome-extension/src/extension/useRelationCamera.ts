import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export type RelationView = { x: number; y: number; scale: number; fitted?: boolean; positions?: Record<string, { x: number; y: number }> };

export function useRelationCamera(view: RefObject<RelationView | null>) {
  const [camera, setCamera] = useState<RelationView>(view.current ?? { x: 0, y: 0, scale: 1 });
  const target = useRef<RelationView | null>(null);
  const frame = useRef(0);
  const cancel = () => { cancelAnimationFrame(frame.current); frame.current = 0; target.current = null; };
  const write = (next: RelationView) => { const positions = view.current?.positions; const current = { ...next, ...(positions ? { positions } : {}) }; view.current = current; setCamera(current); };
  const update = (next: RelationView) => { cancel(); write(next); };
  const smooth = (next: RelationView) => {
    target.current = next;
    if (frame.current) return;
    let previous = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = (time: number) => {
      const goal = target.current;
      if (!goal) return;
      const current = view.current ?? camera;
      const dt = Math.min(.04, Math.max(0, (time - previous) / 1000));
      previous = time;
      const weight = 1 - Math.exp(-(reduced ? 40 : 22) * dt);
      const next = {
        x: current.x + (goal.x - current.x) * weight,
        y: current.y + (goal.y - current.y) * weight,
        scale: current.scale + (goal.scale - current.scale) * weight,
      };
      if (Math.max(Math.abs(goal.x - next.x), Math.abs(goal.y - next.y), Math.abs(goal.scale - next.scale) * 1240) < .03) {
        write(goal); frame.current = 0; target.current = null;
      } else { write(next); frame.current = requestAnimationFrame(animate); }
    };
    frame.current = requestAnimationFrame(animate);
  };
  useLayoutEffect(() => cancel, [view]);
  return { camera, target, update, smooth, cancel };
}
