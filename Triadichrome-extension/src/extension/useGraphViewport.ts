import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

type View = { x: number; y: number; scale: number };
type Point = { x: number; y: number };
const minScale = 0.15;
const maxScale = 2.5;
const clampScale = (scale: number) => Math.max(minScale, Math.min(maxScale, scale));
const interactive = "button, input, select, textarea, a, [contenteditable], .graph-view-controls";

/** View changes stay local to the screen and never change the aggregation data. */
export function useGraphViewport(viewport: RefObject<HTMLDivElement | null>, width: number, height: number) {
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const current = useRef(view);
  const automaticFit = useRef(true);
  const pointers = useRef(new Map<number, Point>());
  const anchor = useRef<{ view: View; center: Point; distance: number } | null>(null);
  const apply = useCallback((next: View) => { current.current = next; setView(next); }, []);
  const panBy = useCallback((x: number, y: number) => {
    if (!x && !y) return;
    automaticFit.current = false;
    apply({ ...current.current, x: current.current.x + x, y: current.current.y + y });
  }, [apply]);
  const zoomAt = useCallback((scale: number, point: Point) => {
    automaticFit.current = false;
    const before = current.current;
    const nextScale = clampScale(scale);
    const ratio = nextScale / before.scale;
    apply({ scale: nextScale, x: point.x - (point.x - before.x) * ratio, y: point.y - (point.y - before.y) * ratio });
  }, [apply]);
  const zoom = (factor: number) => {
    const element = viewport.current;
    if (element) zoomAt(current.current.scale * factor, { x: element.clientWidth / 2, y: element.clientHeight / 2 });
  };
  const fit = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    automaticFit.current = true;
    const scale = clampScale(Math.min(1, (element.clientWidth - 32) / Math.max(1, width), (element.clientHeight - 48) / Math.max(1, height)));
    apply({ scale, x: (element.clientWidth - width * scale) / 2, y: Math.max(16, (element.clientHeight - height * scale) / 2) });
  }, [viewport, width, height, apply]);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () => { if (automaticFit.current) fit(); };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [viewport, fit]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest("input, select, textarea")) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      zoomAt(current.current.scale * Math.exp(-Math.max(-160, Math.min(160, delta)) * 0.003), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    // A non-passive listener keeps wheel/pinch gestures inside the map instead of scrolling the page.
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [viewport, zoomAt]);

  const metrics = () => {
    const values = [...pointers.current.values()];
    const first = values[0];
    if (!first) return null;
    const second = values[1] ?? first;
    return { center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }, distance: Math.hypot(second.x - first.x, second.y - first.y) };
  };
  const rebase = () => {
    const points = metrics();
    anchor.current = points ? { ...points, view: current.current } : null;
    setPanning(points !== null);
  };
  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rebase();
  };
  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget || !event.target.closest(".aggregation-canvas") || pointers.current.size) return;
    const outer = event.currentTarget.getBoundingClientRect();
    const inner = event.target.getBoundingClientRect();
    // Tab/Enter can reach nodes beyond the current view without introducing native scroll offsets.
    const shift = (start: number, end: number, low: number, high: number) => start < low ? low - start : end > high ? high - end : 0;
    panBy(shift(inner.left, inner.right, outer.left + 12, outer.right - 12), shift(inner.top, inner.bottom, outer.top + 12, outer.bottom - 56));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const directions: Record<string, Point> = { ArrowLeft: { x: 60, y: 0 }, ArrowRight: { x: -60, y: 0 }, ArrowUp: { x: 0, y: 60 }, ArrowDown: { x: 0, y: -60 } };
    const direction = directions[event.key];
    if (direction) panBy(direction.x, direction.y);
    else if (event.key === "+" || event.key === "=") zoom(1.25);
    else if (event.key === "-") zoom(0.8);
    else if (event.key === "Home" || event.key === "0") fit();
    else return;
    event.preventDefault();
  };
  return {
    view, panning, panBy, zoom, fit, minScale, maxScale,
    handlers: {
      onFocusCapture, onKeyDown,
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || (event.target as Element).closest(interactive)) return;
        event.preventDefault();
        automaticFit.current = false;
        event.currentTarget.focus({ preventScroll: true });
        const rect = event.currentTarget.getBoundingClientRect();
        pointers.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        event.currentTarget.setPointerCapture(event.pointerId);
        rebase();
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId) || !anchor.current) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        pointers.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        const next = metrics()!;
        const start = anchor.current;
        const scale = clampScale(start.view.scale * (start.distance > 0 ? next.distance / start.distance : 1));
        const ratio = scale / start.view.scale;
        apply({ scale, x: next.center.x - (start.center.x - start.view.x) * ratio, y: next.center.y - (start.center.y - start.view.y) * ratio });
      },
      onPointerUp: endPointer, onPointerCancel: endPointer, onLostPointerCapture: endPointer,
      onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => {
        if ((event.target as Element).closest(interactive)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        zoomAt(current.current.scale * 1.5, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      },
    },
  };
}
