import type { Database } from "./sqliteRuntime";
import { openTriadicDatabase, exportTriadicDatabase } from "./triadicDatabase";
import { syncInitiativeStartMonths } from "./initiativeStartMonths";
/** All changes happen on a private copy, with one validation/export and guaranteed release. */
export async function editDatabase<T>(bytes: Uint8Array, change: (db: Database) => T): Promise<{ bytes: Uint8Array; result: T }> {
  const db = await openTriadicDatabase(bytes);
  try {
    db.run("BEGIN");
    const result = change(db);
    syncInitiativeStartMonths(db);
    db.run("UPDATE plan SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    db.run("COMMIT");
    return { result, bytes: exportTriadicDatabase(db) };
  } finally { db.close(); }
}
