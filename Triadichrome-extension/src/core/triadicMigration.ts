import { type Database } from "sql.js";
import { AGGREGATION_SQL } from "./aggregationSchema";
import { ACCOUNT_CODE_COLUMN_SQL, DETAILS_SQL, INITIATIVE_ROWS_SQL, TRIADIC_VIEWS_SQL } from "./triadicSchema";

export function hasColumn(database: Database, table: "accounts" | "initiatives", column: string): boolean {
  return database.exec(`PRAGMA table_info(${table})`)[0]!.values.some(item => item[1] === column);
}

/** Only call on a private copy that will be published after a successful write. */
export function migrateTriadicDatabase(database: Database): void {
  database.run("BEGIN");
  try {
    if (!hasColumn(database, "accounts", "code")) database.run(`ALTER TABLE accounts ADD COLUMN ${ACCOUNT_CODE_COLUMN_SQL}`);
    database.run("CREATE UNIQUE INDEX IF NOT EXISTS accounts_code_idx ON accounts (budget_id, code)");
    if (database.exec("PRAGMA user_version")[0]!.values[0]![0] === 1) {
      database.run("ALTER TABLE accounts ADD COLUMN attribute TEXT CHECK (attribute IN ('sales', 'cost', 'expense', 'profit'))");
      database.run("ALTER TABLE initiatives ADD COLUMN note TEXT NOT NULL DEFAULT ''");
      database.run("ALTER TABLE initiatives ADD COLUMN fiscal_year INTEGER CHECK (fiscal_year BETWEEN 1 AND 9998)");
      database.exec(INITIATIVE_ROWS_SQL);
      database.exec("DROP VIEW expansion_view; DROP VIEW cost_view; DROP VIEW detail_view;");
      const [table, indexes] = DETAILS_SQL.split("CREATE INDEX details_period_idx");
      database.exec(table!.replace("CREATE TABLE details", "CREATE TABLE migrated_details"));
      const columns = "id, budget_id, period_id, initiative_id, account_id, budget_amount, actual_amount, budget_sales_amount, actual_sales_amount, budget_profit_amount, actual_profit_amount, note";
      database.exec(`INSERT INTO migrated_details (${columns}) SELECT ${columns} FROM details;
        DROP TABLE details; ALTER TABLE migrated_details RENAME TO details;
        CREATE INDEX details_period_idx${indexes}`);
      database.exec(TRIADIC_VIEWS_SQL);
      database.exec("PRAGMA user_version = 2; UPDATE triadic_metadata SET value = '2' WHERE key = 'format_version';");
    }
    if (Number(database.exec("PRAGMA user_version")[0]!.values[0]![0]) < 3) {
      // Preserve the order previously shown to the user before enabling manual order.
      const rows = database.exec("SELECT id FROM accounts WHERE budget_id = 1 ORDER BY code IS NULL, code, sort_order, id")[0]?.values ?? [];
      rows.forEach(([id], index) => database.run("UPDATE accounts SET sort_order = ? WHERE id = ?", [index, Number(id)]));
      database.exec(AGGREGATION_SQL);
      database.exec("PRAGMA user_version = 3; UPDATE triadic_metadata SET value = '3' WHERE key = 'format_version';");
    }
    if (database.exec("PRAGMA foreign_key_check").length) throw new Error("保存データの参照を移行できませんでした。");
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}
