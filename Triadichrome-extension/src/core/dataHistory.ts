import type { Database } from "sql.js";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { DATA_HISTORY_SQL, hasDataHistory, isHistoryTimestamp } from "./dataHistorySchema";

export const HISTORY_INTERVAL_MS = 5 * 60 * 1000;
export type DataHistoryEntry = { id: number; recordedAt: string };
export type DataHistoryStatus = { entries: DataHistoryEntry[]; dirtySince: string | null };
export const emptyDataHistory: DataHistoryStatus = { entries: [], dirtySince: null };
export type HistoryDeletion = { ids: number[] } | { before: string };

function timestamp(now: string): string {
  if (!isHistoryTimestamp(now)) throw new Error("履歴の日時が正しくありません。");
  return now;
}

function state(database: Database) {
  const row = database.exec("SELECT next_id, dirty_since, saved_at FROM data_history_state WHERE id = 1")[0]!.values[0]!;
  return { nextId: Number(row[0]), dirtySince: row[1] === null ? null : String(row[1]), savedAt: String(row[2]) };
}

async function snapshotOf(bytes: Uint8Array): Promise<Uint8Array> {
  const database = await openTriadicDatabase(bytes);
  try {
    database.exec("DROP TABLE IF EXISTS data_history; DROP TABLE IF EXISTS data_history_state; VACUUM;");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}

function initialize(database: Database, now: string): void {
  database.exec(DATA_HISTORY_SQL);
  database.run("INSERT INTO data_history_state VALUES (1, 1, 1, NULL, ?)", [timestamp(now)]);
}

function append(database: Database, snapshot: Uint8Array, now: string): void {
  const { nextId } = state(database);
  if (!Number.isSafeInteger(nextId + 1)) throw new Error("これ以上履歴を記録できません。");
  database.run("INSERT INTO data_history (id, recorded_at, snapshot) VALUES (?, ?, ?)", [nextId, timestamp(now), snapshot]);
  database.run("UPDATE data_history_state SET next_id = ? WHERE id = 1", [nextId + 1]);
}

export async function readDataHistory(bytes: Uint8Array): Promise<DataHistoryStatus> {
  const database = await openTriadicDatabase(bytes);
  try {
    if (!hasDataHistory(database)) return { entries: [], dirtySince: null };
    return {
      entries: (database.exec("SELECT id, recorded_at FROM data_history ORDER BY id DESC")[0]?.values ?? [])
        .map(([id, at]) => ({ id: Number(id), recordedAt: String(at) })),
      dirtySince: state(database).dirtySince,
    };
  } finally { database.close(); }
}

/** Called on the copy before writing; the first successful change also preserves its original. */
export async function trackHistoryChange(before: Uint8Array, after: Uint8Array, now = new Date().toISOString()): Promise<Uint8Array> {
  timestamp(now);
  const database = await openTriadicDatabase(after);
  try {
    if (!hasDataHistory(database)) {
      initialize(database, now);
      append(database, await snapshotOf(before), now);
    }
    database.run("UPDATE data_history_state SET dirty_since = COALESCE(dirty_since, ?), saved_at = ? WHERE id = 1", [now, now]);
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}

/** Force checkpoints for closing/preview/restore; otherwise preserve the five-minute deadline. */
export async function recordDataHistory(bytes: Uint8Array, now = new Date().toISOString(), force = false): Promise<Uint8Array> {
  timestamp(now);
  const database = await openTriadicDatabase(bytes);
  try {
    if (!hasDataHistory(database)) return bytes;
    const { dirtySince } = state(database);
    if (dirtySince === null || (!force && Date.parse(now) - Date.parse(dirtySince) < HISTORY_INTERVAL_MS)) return bytes;
    append(database, await snapshotOf(bytes), now);
    database.run("UPDATE data_history_state SET dirty_since = NULL WHERE id = 1");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}

export async function readHistorySnapshot(bytes: Uint8Array, id: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("履歴を選択してください。");
  const database = await openTriadicDatabase(bytes);
  try {
    if (!hasDataHistory(database)) throw new Error("指定した履歴が見つかりません。");
    const snapshot = database.exec("SELECT snapshot FROM data_history WHERE id = ?", [id])[0]?.values[0]?.[0];
    if (!(snapshot instanceof Uint8Array)) throw new Error("指定した履歴が見つかりません。");
    const copy = Uint8Array.from(snapshot);
    const historic = await openTriadicDatabase(copy);
    try {
      if (hasDataHistory(historic)) throw new Error("履歴の中に履歴を含めることはできません。");
      const fiscalYear = (db: Database) => db.exec("SELECT fiscal_year FROM budgets WHERE id = 1")[0]?.values[0]?.[0];
      if (fiscalYear(historic) !== fiscalYear(database)) throw new Error("履歴の基準年度が一致しません。");
    } finally { historic.close(); }
    return copy;
  } finally { database.close(); }
}

export async function restoreDataHistory(bytes: Uint8Array, id: number, now = new Date().toISOString()): Promise<Uint8Array> {
  timestamp(now);
  const selected = await readHistorySnapshot(bytes, id);
  const current = await openTriadicDatabase(bytes);
  const restored = await openTriadicDatabase(selected);
  try {
    // Preserve all surviving history, independently of the business state being restored.
    initialize(restored, now);
    const entries = current.exec("SELECT id, recorded_at, snapshot FROM data_history ORDER BY id")[0]?.values ?? [];
    for (const [entryId, recordedAt, snapshot] of entries) {
      restored.run("INSERT INTO data_history VALUES (?, ?, ?)", [Number(entryId), String(recordedAt), snapshot as Uint8Array]);
    }
    restored.run("UPDATE data_history_state SET next_id = ? WHERE id = 1", [state(current).nextId]);
    append(restored, await snapshotOf(bytes), now);
    append(restored, selected, now);
    return exportTriadicDatabase(restored);
  } finally { current.close(); restored.close(); }
}

export async function deleteDataHistory(bytes: Uint8Array, deletion: HistoryDeletion): Promise<Uint8Array> {
  if ("before" in deletion) timestamp(deletion.before);
  else if (!deletion.ids.length || deletion.ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error("削除する履歴を選択してください。");
  const database = await openTriadicDatabase(bytes);
  try {
    if (!hasDataHistory(database)) return bytes;
    database.exec("BEGIN");
    try {
      if ("before" in deletion) database.run("DELETE FROM data_history WHERE recorded_at < ?", [deletion.before]);
      else for (const id of new Set(deletion.ids)) {
        database.run("DELETE FROM data_history WHERE id = ?", [id]);
        if (!database.getRowsModified()) throw new Error("削除する履歴が見つかりません。");
      }
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    database.exec("VACUUM");
    return exportTriadicDatabase(database);
  } finally { database.close(); }
}
