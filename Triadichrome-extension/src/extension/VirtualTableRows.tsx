import { Fragment, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { visibleRows } from "../core/tables/visibleRows";
import "./VirtualTableRows.css";
export function useRowWindow(container: RefObject<HTMLDivElement | null>, count: number, rowHeight: number, threshold = 200, offset = 0) {
  const virtual = count > threshold;
  const [window, setWindow] = useState({ start: 0, end: 40 });
  useLayoutEffect(() => {
    const node = container.current;
    if (!node || !virtual) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = visibleRows(count, rowHeight, node.scrollTop, node.clientHeight, offset);
      setWindow(previous => previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    node.addEventListener("scroll", schedule, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener("scroll", schedule); cancelAnimationFrame(frame); };
  }, [container, count, rowHeight, virtual, offset]);
  return virtual ? { start: Math.min(window.start, count), end: Math.min(window.end, count) } : { start: 0, end: count };
}
export function RowSpacer({ height, columns }: { height: number; columns: number }) {
  return height > 0 ? <tr aria-hidden="true" className="virtual-row-spacer"><td colSpan={columns} style={{ height }} /></tr> : null;
}
export function WindowRows<T>({ items, count, height, columns, render }: {
  items: { item: T; index: number }[]; count: number; height: number; columns: number;
  render: (item: T, index: number) => ReactNode;
}) {
  let previous = 0;
  return <>{items.map(({ item, index }) => {
    const gap = (index - previous) * height;
    previous = index + 1;
    return <Fragment key={index}><RowSpacer height={gap} columns={columns} />{render(item, index)}</Fragment>;
  })}<RowSpacer height={(count - previous) * height} columns={columns} /></>;
}
