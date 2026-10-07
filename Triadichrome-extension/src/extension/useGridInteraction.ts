import { useEffect, useRef, useState } from "react";
import { gridBounds, type GridCell, type GridSelection } from "../core/tables/previousGrid";
/** Selection/focus lifetime shared by grids; amount rules stay in their adapters. */
export function useGridInteraction() {
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [editing, setEditing] = useState(false);
  const table = useRef<HTMLTableElement>(null);
  const dragging = useRef(false);
  const original = useRef("");
  const bounds = selection ? gridBounds(selection) : null;
  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);
  const focus = (cell: GridCell, extend = false) => {
    setSelection(current => ({ anchor: extend && current ? current.anchor : cell, end: cell }));
    setEditing(false);
    table.current?.querySelector<HTMLInputElement>(`input[data-row="${cell.row}"][data-column="${cell.column}"]`)?.focus();
  };
  return { selection, setSelection, editing, setEditing, table, dragging, original, bounds, focus };
}
