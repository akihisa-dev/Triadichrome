import { useEffect, useMemo, useState } from "react";
import type { PlanContents } from "../core/domain/plan";
import type { DetailRecord } from "../core/domain/details";
import { buildDetails } from "../core/tables/details";
import { sortTableRows, type TableSort } from "../core/tables/tableSort";
import type { RowWindow } from "../core/tables/visibleRows";
import { detailColumns } from "./detailPresentation";
import { processPlan } from "./planProcessing";
export const detailCount = (contents: PlanContents) => contents.previousAmounts.length + contents.initiatives.reduce((count, initiative) => count + initiative.rows.length * 24, 0);
export function useDetailWindow(contents: PlanContents, sort: TableSort | null, window: RowWindow, pinnedId?: string) {
  const large = detailCount(contents) > 2000;
  const local = useMemo(() => large ? [] : sortTableRows(contents.details ?? buildDetails(contents), detailColumns(contents), sort), [contents, sort, large]);
  const [source, setSource] = useState<{ contents: PlanContents; sort: TableSort | null; id: number } | null>(null);
  const [page, setPage] = useState<{ id: number; items: { item: DetailRecord; index: number }[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!large) return;
    let active = true;
    let id: number | undefined;
    setError("");
    void processPlan("detailOpen", contents, sort).then(value => {
      id = value;
      if (active) setSource({ contents, sort, id: value });
      else void processPlan("detailClose", value).catch(() => {});
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "明細を読み込めませんでした。"); });
    return () => { active = false; if (id !== undefined) void processPlan("detailClose", id).catch(() => {}); };
  }, [contents, sort, large]);
  useEffect(() => {
    if (!large || !source || source.contents !== contents || source.sort !== sort) return;
    let active = true;
    void processPlan("detailPage", source.id, window.start, window.end, pinnedId).then(items => {
      if (active) setPage({ id: source.id, items });
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "明細を読み込めませんでした。"); });
    return () => { active = false; };
  }, [source, contents, sort, large, window.start, window.end, pinnedId]);
  const items = large ? (source?.contents === contents && source.sort === sort && page?.id === source.id ? page.items : []) : local.map((item, index) => ({ item, index }));
  const neighbor = async (rowId: string, offset: number) => {
    if (large) return source ? processPlan("detailNeighbor", source.id, rowId, offset) : null;
    const current = local.findIndex(row => row.id === rowId);
    if (current === -1) return null;
    const index = current + offset;
    return index >= 0 && index < local.length ? { item: local[index]!, index } : null;
  };
  return { items, neighbor, error, loading: large && (!source || source.contents !== contents || source.sort !== sort || page?.id !== source.id) };
}
