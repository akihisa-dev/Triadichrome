import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";

/** A pre-default v5 file for existing empty-master and migration tests. */
export async function createEmptyTestPlan(): Promise<Uint8Array> {
  const database = await openTriadicDatabase(await createTriadicDatabase());
  try {
    database.exec(`DELETE FROM aggregation_members;
      DELETE FROM aggregation_groups WHERE required_key IS NULL;
      UPDATE aggregation_groups SET sort_order = id - 1;
      ALTER TABLE aggregation_groups DROP COLUMN display_name;
      DELETE FROM accounts;
      PRAGMA user_version = 5;
      UPDATE triadic_metadata SET value = '5' WHERE key = 'format_version';`);
    return database.export();
  } finally { database.close(); }
}
