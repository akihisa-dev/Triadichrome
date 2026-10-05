import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";
import { LEGACY_SCHEMA_SQL } from "../../Triadichrome-extension/src/core/triadicSchema";

/** Materialize genuine v9 tables instead of relabelling a normalized database. */
export async function asLegacyTestPlan(bytes: Uint8Array): Promise<Uint8Array> {
  const db = await openTriadicDatabase(bytes);
  try {
    const names = ["triadic_metadata", "budgets", "periods", "accounts", "expansions", "industries", "departments", "period_types", "aggregation_groups", "aggregation_members", "initiatives", "initiative_rows", "details"];
    const data = names.map(name => ({ name, result: db.exec(`SELECT * FROM ${name}`)[0] }));
    db.run("PRAGMA foreign_keys = OFF");
    const objects = db.exec("SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') AND name NOT LIKE 'sqlite_%'")[0]!.values;
    for (const type of ["view", "table"]) for (const object of objects.filter(row => row[0] === type)) db.run(`DROP ${type} "${String(object[1])}"`);
    db.exec(LEGACY_SCHEMA_SQL);
    db.run("PRAGMA foreign_keys = OFF");
    for (const name of [...names].reverse()) db.run(`DELETE FROM ${name}`);
    for (const { name, result } of data) {
      if (!result) continue;
      const columns = result.columns.filter(column => column !== "revision");
      for (const row of result.values) db.run(`INSERT INTO ${name} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, columns.map(column => row[result.columns.indexOf(column)]!));
    }
    db.exec("PRAGMA user_version = 9; UPDATE triadic_metadata SET value = '9' WHERE key = 'format_version';");
    return db.export();
  } finally { db.close(); }
}

export async function createEmptyTestPlan(): Promise<Uint8Array> {
  const database = await openTriadicDatabase(await asLegacyTestPlan(await createTriadicDatabase()));
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

export async function createCurrentEmptyTestPlan(): Promise<Uint8Array> {
  const db = await openTriadicDatabase(await createTriadicDatabase());
  try {
    db.exec("DELETE FROM aggregation_members; DELETE FROM aggregation_groups WHERE required_key IS NULL; UPDATE aggregation_groups SET sort_order = id - 1, display_name = NULL; DELETE FROM accounts;");
    return db.export();
  } finally { db.close(); }
}
