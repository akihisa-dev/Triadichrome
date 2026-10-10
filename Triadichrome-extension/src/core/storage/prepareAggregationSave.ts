import type { AggregationChange } from "../domain/aggregationMaster";
import { listAccounts } from "./accountMaster";
import { listAggregations } from "./aggregations";
import { applyAggregationChange } from "./aggregationMaster";
import { historyFromDatabase, snapshotFromDatabase, trackHistoryInDatabase } from "./dataHistory";
import { readContents } from "./readPlan";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";

/** Share one private connection across master editing, undo and history preparation.
 * Validate the input, both business snapshots and the final complete file as before.
 * Aggregation edits cannot change initiatives or their derived start months.
 */
export async function prepareAggregationSave(bytes: Uint8Array, change: AggregationChange, includeDetails = true, now = new Date().toISOString()) {
  const database = await openTriadicDatabase(bytes);
  try {
    const master = () => JSON.stringify([listAccounts(database), listAggregations(database)]);
    const originalMaster = master();
    const before = await snapshotFromDatabase(database);
    database.run("BEGIN");
    applyAggregationChange(database, change);
    database.run("UPDATE plan SET updated_at = ? WHERE id = 1", [now]);
    database.run("COMMIT");
    const changed = originalMaster !== master();
    const after = changed ? await snapshotFromDatabase(database) : null;
    trackHistoryInDatabase(database, before, now);
    const savedBytes = exportTriadicDatabase(database);
    return { bytes: savedBytes, contents: readContents(database, includeDetails), savedHistory: historyFromDatabase(database), operation: after ? { before, after } : null };
  } finally { database.close(); }
}
