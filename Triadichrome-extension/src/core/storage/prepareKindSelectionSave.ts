import type { KindScreen, KindId } from "../domain/kinds";
import { applyKindSelection } from "./settings";
import { historyFromDatabase, snapshotFromDatabase, trackHistoryInDatabase } from "./dataHistory";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";

/** Selection changes cannot alter amounts, master data or derived start months.
 * Keep full file/snapshot validation while avoiding full plan reads and projections.
 */
export async function prepareKindSelectionSave(bytes: Uint8Array, screen: KindScreen, selected: KindId[], now = new Date().toISOString()) {
  const database = await openTriadicDatabase(bytes);
  try {
    const original = database.exec("SELECT first_kind, second_kind FROM kind_selections WHERE screen = ?", [screen])[0]?.values[0];
    const before = await snapshotFromDatabase(database);
    database.run("BEGIN");
    applyKindSelection(database, screen, selected);
    database.run("UPDATE document_info SET updated_at = ? WHERE id = 1", [now]);
    database.run("COMMIT");
    const changed = original?.[0] !== selected[0] || original?.[1] !== (selected[1] ?? null);
    const after = changed ? await snapshotFromDatabase(database) : null;
    trackHistoryInDatabase(database, before, now);
    return { bytes: exportTriadicDatabase(database), savedHistory: historyFromDatabase(database), operation: after ? { before, after } : null };
  } finally { database.close(); }
}
