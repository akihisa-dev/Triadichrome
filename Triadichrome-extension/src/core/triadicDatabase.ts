import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
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

function closeDatabase(database: Database): never {
  database.close();
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
    closeDatabase(database);
  }

  const metadata = database.exec(
    "SELECT key, value FROM triadic_metadata WHERE key IN ('format_id', 'format_version', 'container')",
  )[0];

  if (!metadata || metadata.values.length !== 3) {
    closeDatabase(database);
  }

  const metadataValues = new Map(
    metadata.values.map(([key, value]) => [String(key), String(value)]),
  );

  if (
    metadataValues.get("format_id") !== TRIADIC_FORMAT_ID ||
    metadataValues.get("format_version") !== String(TRIADIC_FORMAT_VERSION) ||
    metadataValues.get("container") !== "sqlite"
  ) {
    closeDatabase(database);
  }

  const userVersion = database.exec("PRAGMA user_version")[0]?.values[0]?.[0];
  if (userVersion !== TRIADIC_FORMAT_VERSION) {
    closeDatabase(database);
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
    return database.export();
  } finally {
    database.close();
  }
}

export async function validateTriadicDatabase(
  data: ArrayLike<number>,
): Promise<void> {
  const sql = await sqlJsPromise;
  let database: Database | undefined;

  try {
    database = new sql.Database(data);
    assertTriadicDatabase(database);
  } catch (error) {
    if (error instanceof TriadicFileError) {
      throw error;
    }

    throw new TriadicFileError("Triadicファイルを読み込めませんでした。");
  } finally {
    database?.close();
  }
}
