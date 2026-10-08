export type RowWindow = { start: number; end: number };
/** Fixed-height rows keep the scroll extent independent of the rendered row count. */
export function visibleRows(count: number, rowHeight: number, top: number, height: number, offset = 0, overscan = 8): RowWindow {
  const start = Math.max(0, Math.min(count, Math.floor(Math.max(0, top - offset) / rowHeight) - overscan));
  const end = Math.min(count, Math.max(start, Math.ceil(Math.max(0, top - offset + height) / rowHeight) + overscan));
  return { start, end };
}
