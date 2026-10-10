import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";

/** Unsupported-format fixture is read-only: no migration or file rewrite. */
export async function createEmptyTestPlan(): Promise<Uint8Array> {
  const db = await openTriadicDatabase(await createTriadicDatabase(2026));
  try {
    db.exec("PRAGMA user_version = 12; UPDATE triadic_metadata SET value = '12' WHERE key = 'format_version';");
    return db.export();
  } finally { db.close(); }
}
export async function createCurrentEmptyTestPlan(fiscalYear = 2026): Promise<Uint8Array> {
  const db = await openTriadicDatabase(await createTriadicDatabase(fiscalYear));
  try {
    db.exec("DELETE FROM aggregation_members; DELETE FROM aggregation_groups WHERE required_key IS NULL; UPDATE aggregation_groups SET display_name = NULL; DELETE FROM accounts; DELETE FROM master_order; INSERT INTO master_order(position,aggregation_group_id) SELECT id - 1,id FROM aggregation_groups;");
    return db.export();
  } finally { db.close(); }
}
