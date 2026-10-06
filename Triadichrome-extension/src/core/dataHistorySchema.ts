import type { Database } from "sql.js";

export const DATA_HISTORY_SQL = `
CREATE TABLE data_history (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  recorded_at TEXT NOT NULL,
  snapshot BLOB NOT NULL
);
CREATE TABLE data_history_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL CHECK (version = 1),
  next_id INTEGER NOT NULL CHECK (next_id > 0),
  dirty_since TEXT,
  saved_at TEXT NOT NULL
);`;

export function isHistoryTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function hasDataHistory(database: Database): boolean {
  return database.exec("SELECT name FROM sqlite_master WHERE name = 'data_history_state'")[0]?.values.length === 1;
}

/** Optional extension to format 14: history-free current files remain valid. */
export function validateDataHistory(database: Database): void {
  const objects = database.exec("SELECT type, name FROM sqlite_master WHERE name IN ('data_history', 'data_history_state')")[0]?.values ?? [];
  if (!objects.length) return;
  const invalid = () => { throw new Error("データ履歴の形式が正しくありません。"); };
  if (objects.length !== 2 || objects.some(([type]) => type !== "table")) invalid();
  const state = database.exec("SELECT id, version, next_id, dirty_since, saved_at FROM data_history_state")[0]?.values ?? [];
  const row = state[0];
  if (state.length !== 1 || !row || row[0] !== 1 || row[1] !== 1 || !Number.isSafeInteger(row[2]) || Number(row[2]) < 1
    || (row[3] !== null && !isHistoryTimestamp(row[3])) || !isHistoryTimestamp(row[4])) invalid();
  const entries = database.exec("SELECT id, recorded_at, typeof(snapshot), length(snapshot), hex(substr(snapshot, 1, 16)) FROM data_history")[0]?.values ?? [];
  for (const [id, timestamp, type, size, header] of entries) {
    if (!Number.isSafeInteger(id) || Number(id) < 1 || Number(id) >= Number(row![2]) || !isHistoryTimestamp(timestamp)
      || type !== "blob" || Number(size) < 100 || header !== "53514C69746520666F726D6174203300") invalid();
  }
}
