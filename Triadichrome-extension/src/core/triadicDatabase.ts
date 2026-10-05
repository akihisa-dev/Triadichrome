import { seedDefaultCostMaster } from "./defaultCostMaster";
import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import { listAggregations, validateAggregations } from "./aggregations";
import {
  TRIADIC_FORMAT_ID,
  TRIADIC_FORMAT_VERSION,
  TRIADIC_SCHEMA_OBJECTS,
  TRIADIC_SCHEMA_SQL,
} from "./triadicSchema";

export {
  TRIADIC_FILE_EXTENSION,
  TRIADIC_MIME_TYPE,
} from "./triadicSchema";

const sqlJsPromise = initSqlJs({
  locateFile: () => wasmUrl,
});

export class TriadicFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriadicFileError";
  }
}

function invalidDatabase(): never {
  throw new TriadicFileError("Triadicファイルの形式が正しくありません。");
}

function assertTriadicDatabase(database: Database): void {
  const schemaObjectNames = TRIADIC_SCHEMA_OBJECTS.map(({ name }) => `'${name}'`).join(
    ", ",
  );
  const schemaObjects = database.exec(
    `SELECT type, name FROM sqlite_master WHERE name IN (${schemaObjectNames})`,
  )[0];
  const schemaObjectKeys = new Set(
    schemaObjects?.values.map(([type, name]) => `${String(type)}:${String(name)}`),
  );

  if (
    !TRIADIC_SCHEMA_OBJECTS.every(({ type, name }) =>
      schemaObjectKeys.has(`${type}:${name}`),
    )
  ) {
    invalidDatabase();
  }

  const metadata = database.exec(
    "SELECT key, value FROM triadic_metadata WHERE key IN ('format_id', 'format_version', 'container')",
  )[0];

  if (!metadata || metadata.values.length !== 3) {
    invalidDatabase();
  }

  const metadataValues = new Map(
    metadata.values.map(([key, value]) => [String(key), String(value)]),
  );

  if (
    metadataValues.get("format_id") !== TRIADIC_FORMAT_ID ||
    !["1", "2", "3", "4", "5", String(TRIADIC_FORMAT_VERSION)].includes(metadataValues.get("format_version") ?? "") ||
    metadataValues.get("container") !== "sqlite"
  ) {
    invalidDatabase();
  }

  const userVersion = database.exec("PRAGMA user_version")[0]?.values[0]?.[0];
  if (String(userVersion) !== metadataValues.get("format_version")) {
    invalidDatabase();
  }

  if (Number(userVersion) >= 2) {
    database.exec(`SELECT attribute FROM accounts LIMIT 0;
      SELECT note, fiscal_year FROM initiatives LIMIT 0;
      SELECT id, initiative_id, account_id, sort_order FROM initiative_rows LIMIT 0;
      SELECT entry_row_id FROM details LIMIT 0;`);
  }

  database.exec(`
    SELECT id, name, period_start, period_end, created_at, updated_at
      FROM budgets LIMIT 0;
    SELECT id, budget_id, year, month
      FROM periods LIMIT 0;
    SELECT id, budget_id, name, sort_order
      FROM initiatives LIMIT 0;
    SELECT id, budget_id, name, sort_order
      FROM accounts LIMIT 0;
    SELECT id, budget_id, period_id, initiative_id, account_id,
      budget_amount, actual_amount, budget_sales_amount, actual_sales_amount,
      budget_profit_amount, actual_profit_amount, note
      FROM details LIMIT 0;
    SELECT id, budget_id, year, month, initiative_name, account_name,
      budget_amount, actual_amount, budget_sales_amount, actual_sales_amount,
      budget_profit_amount, actual_profit_amount, note
      FROM detail_view LIMIT 0;
    SELECT budget_id, period_id, year, month, account_id, account_name,
      budget_amount, actual_amount, budget_sales_amount, actual_sales_amount,
      budget_profit_amount, actual_profit_amount
      FROM cost_view LIMIT 0;
    SELECT budget_id, period_id, year, month, initiative_id, initiative_name,
      budget_sales_amount, actual_sales_amount, budget_profit_amount,
      actual_profit_amount
      FROM expansion_view LIMIT 0;
  `);

  if (Number(userVersion) >= 4) {
    database.exec("SELECT id, code, name FROM expansions LIMIT 0");
    if (database.exec("SELECT id FROM expansions WHERE typeof(code) != 'text' OR code = '' OR code GLOB '*[^0-9]*' OR typeof(name) != 'text' OR trim(name) = ''").length ||
        database.exec("SELECT code FROM expansions GROUP BY code HAVING COUNT(*) > 1").length ||
        database.exec("SELECT name FROM expansions GROUP BY name HAVING COUNT(*) > 1").length) invalidDatabase();
  }
  if (Number(userVersion) >= 5) {
    database.exec("SELECT id, code, name FROM industries LIMIT 0");
    if (database.exec("SELECT id FROM industries WHERE typeof(code) != 'text' OR code = '' OR code GLOB '*[^0-9]*' OR typeof(name) != 'text' OR trim(name) = ''").length ||
        database.exec("SELECT code FROM industries GROUP BY code HAVING COUNT(*) > 1").length ||
        database.exec("SELECT name FROM industries GROUP BY name HAVING COUNT(*) > 1").length) invalidDatabase();
  }
  if (Number(userVersion) >= 6) {
    database.exec("SELECT display_name FROM aggregation_groups LIMIT 0");
  }
  const budgets = database.exec("SELECT id FROM budgets")[0]?.values;
  if (budgets?.length !== 1 || budgets[0]?.[0] !== 1) {
    invalidDatabase();
  }
  if (database.exec("PRAGMA foreign_key_check")[0]?.values.length) {
    invalidDatabase();
  }
  if (Number(userVersion) >= 3) {
    validateAggregations(listAggregations(database), new Set((database.exec("SELECT id FROM accounts WHERE budget_id = 1")[0]?.values ?? []).map(([id]) => Number(id))));
  }
}

export async function createTriadicDatabase(): Promise<Uint8Array> {
  const sql = await sqlJsPromise;
  const database = new sql.Database();

  try {
    database.exec(TRIADIC_SCHEMA_SQL);
    const now = new Date().toISOString();
    database.run(
      "INSERT INTO budgets (id, created_at, updated_at) VALUES (1, ?, ?)",
      [now, now],
    );
    seedDefaultCostMaster(database);
    return database.export();
  } finally {
    database.close();
  }
}

/** The caller owns the database and must close it when the document is closed. */
export async function openTriadicDatabase(
  data: ArrayLike<number>,
): Promise<Database> {
  const sql = await sqlJsPromise;
  let database: Database | undefined;

  try {
    database = new sql.Database(data);
    assertTriadicDatabase(database);
    database.exec("PRAGMA foreign_keys = ON");
    return database;
  } catch (error) {
    database?.close();
    if (error instanceof TriadicFileError) {
      throw error;
    }

    throw new TriadicFileError("Triadicファイルを読み込めませんでした。");
  }
}

export async function validateTriadicDatabase(
  data: ArrayLike<number>,
): Promise<void> {
  const database = await openTriadicDatabase(data);
  database.close();
}

export function exportTriadicDatabase(database: Database): Uint8Array {
  try {
    return database.export();
  } finally {
    // sql.js reopens its connection on export, resetting connection pragmas.
    database.exec("PRAGMA foreign_keys = ON");
  }
}
