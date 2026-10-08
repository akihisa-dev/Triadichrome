import * as history from "../core/storage/dataHistory";
import { applyOperationSnapshot } from "../core/storage/operationSnapshot";
import { readPlanContents, readSnapshotContents } from "../core/storage/readPlan";
import { createTriadicDatabase } from "../core/storage/triadicDatabase";
import { applyPlanCommand } from "./planCommands";
import { buildDetails } from "../core/tables/details";
import { sortTableRows, type TableSort } from "../core/tables/tableSort";
import type { PlanContents } from "../core/domain/plan";
import type { DetailRecord } from "../core/domain/details";
import { detailColumns } from "./detailPresentation";

let nextDetails = 0;
const details = new Map<number, DetailRecord[]>();
export const processingTasks = {
  bytesEqual: async (current: Uint8Array, expected: Uint8Array) => {
    if (current.length !== expected.length) return false;
    for (let index = 0; index < current.length; index++) if (current[index] !== expected[index]) return false;
    return true;
  },
  createTriadicDatabase,
  readPlanContents,
  readSnapshotContents,
  applyPlanCommand,
  applyOperationSnapshot,
  createBusinessSnapshot: history.createBusinessSnapshot,
  readDataHistory: history.readDataHistory,
  readHistorySnapshot: history.readHistorySnapshot,
  trackHistoryChange: history.trackHistoryChange,
  recordDataHistory: history.recordDataHistory,
  restoreDataHistory: history.restoreDataHistory,
  deleteDataHistory: history.deleteDataHistory,
  detailOpen: async (contents: PlanContents, sort: TableSort | null) => {
    const id = ++nextDetails;
    details.set(id, sortTableRows(buildDetails(contents), detailColumns(contents), sort));
    return id;
  },
  detailPage: async (id: number, start: number, end: number, pinnedId?: string) => {
    const rows = details.get(id);
    if (!rows) throw new Error("明細の読み込みをやり直してください。");
    const items = rows.slice(start, end).map((item, offset) => ({ item, index: start + offset }));
    if (pinnedId && !items.some(({ item }) => item.id === pinnedId)) {
      const index = rows.findIndex(item => item.id === pinnedId);
      if (index !== -1) items.push({ item: rows[index]!, index });
      items.sort((a, b) => a.index - b.index);
    }
    return items;
  },
  detailClose: async (id: number) => { details.delete(id); },
  detailNeighbor: async (id: number, rowId: string, offset: number) => {
    const rows = details.get(id);
    if (!rows) throw new Error("明細の読み込みをやり直してください。");
    const current = rows.findIndex(row => row.id === rowId);
    if (current === -1) return null;
    const index = current + offset;
    return index >= 0 && index < rows.length ? { item: rows[index]!, index } : null;
  },
};
