import { validateNormalizedData } from "./migration10";
import { INITIAL_KINDS } from "./kindMasterSchema";
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
  const version = Number(database.exec("PRAGMA user_version")[0]?.values[0]?.[0]);
  if (version !== TRIADIC_FORMAT_VERSION) throw new TriadicFileError("この保存形式には対応していません。基準年度を指定して新しいファイルを作成してください。");
  const schemaObjectNames = TRIADIC_SCHEMA_OBJECTS.map(({ name }) => `'${name}'`).join(
    ", ",
  );
  const schemaObjects = database.exec(
    `SELECT type, name FROM sqlite_master WHERE name IN (${schemaObjectNames})`,
  )[0];
  const schemaObjectKeys = new Set(
    schemaObjects?.values.map(([type, name]) => `${String(type)}:${String(name)}`),
  );

  const normalized = Number(database.exec("PRAGMA user_version")[0]?.values[0]?.[0]) >= 10;
  if (
    !TRIADIC_SCHEMA_OBJECTS.every(({ type, name }) =>
      schemaObjectKeys.has(`${normalized && name === "details" ? "view" : type}:${name}`),
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
    metadataValues.get("format_version") !== String(TRIADIC_FORMAT_VERSION) ||
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
  if (Number(userVersion) >= 7) database.exec("SELECT expansion_id FROM initiatives LIMIT 0");
  if (Number(userVersion) >= 8) {
    database.exec("SELECT id, name FROM departments LIMIT 0; SELECT department_id FROM initiatives LIMIT 0;");
    if (database.exec("SELECT id FROM departments WHERE typeof(name) != 'text' OR trim(name) = ''").length ||
        database.exec("SELECT name FROM departments GROUP BY name HAVING COUNT(*) > 1").length) invalidDatabase();
  }
  if (Number(userVersion) >= 9) {
    database.exec("SELECT id, name FROM period_types LIMIT 0; SELECT period_type_id FROM initiatives LIMIT 0;");
    if (database.exec("SELECT id FROM period_types WHERE typeof(name) != 'text' OR trim(name) = ''").length ||
        database.exec("SELECT name FROM period_types GROUP BY name HAVING COUNT(*) > 1").length) invalidDatabase();
  }
  if (Number(userVersion) >= 11) database.exec("SELECT industry_id FROM initiatives LIMIT 0");
  if (Number(userVersion) >= 12) {
    database.exec("SELECT id, name FROM kind_types LIMIT 0");
    const names = database.exec("SELECT name FROM kind_types")[0]?.values ?? [];
    if (names.some(([name]) => typeof name !== "string" || !name.trim()) || new Set(names.map(([name]) => name)).size !== names.length) invalidDatabase();
  }
  if (normalized) {
    database.exec("SELECT id, row_id, month, amount_yen, revision FROM initiative_amounts LIMIT 0; SELECT * FROM initiative_detail_view LIMIT 0;");
    validateNormalizedData(database);
  }
  const settings = database.exec("SELECT fiscal_year, revised_active FROM budgets WHERE id = 1")[0]?.values[0];
  if (!settings || !Number.isInteger(settings[0]) || Number(settings[0]) < 1 || Number(settings[0]) > 9998 || ![0, 1].includes(Number(settings[1]))) invalidDatabase();
  if (database.exec("SELECT id FROM initiatives WHERE fiscal_year != (SELECT fiscal_year FROM budgets WHERE id = 1) OR expansion_id IS NULL OR industry_id IS NULL OR department_id IS NULL").length) invalidDatabase();
  const kinds = database.exec("SELECT id, name FROM kind_types ORDER BY id")[0]?.values ?? [];
  if (kinds.length !== INITIAL_KINDS.length || kinds.some(([id, name], index) => id !== INITIAL_KINDS[index]?.id || name !== INITIAL_KINDS[index]?.kindName)) invalidDatabase();
  database.exec("SELECT row_id, kind_id, month, amount_yen, revision FROM amount_overrides LIMIT 0; SELECT account_id, industry_id, department_id, month, amount_yen, revision FROM previous_amounts LIMIT 0; SELECT screen, first_kind, second_kind FROM kind_selections LIMIT 0;");
  if (database.exec(`SELECT row_id FROM amount_overrides WHERE kind_id NOT BETWEEN 2 AND 5 OR month NOT BETWEEN 1 AND 12
    OR (kind_id = 3 AND month BETWEEN 4 AND 9) OR typeof(amount_yen) != 'integer' OR amount_yen NOT BETWEEN -9007199254740991 AND 9007199254740991
    OR typeof(revision) != 'integer' OR revision < 0
    UNION ALL SELECT account_id FROM previous_amounts WHERE month NOT BETWEEN 1 AND 12 OR typeof(amount_yen) != 'integer'
    OR amount_yen NOT BETWEEN -9007199254740991 AND 9007199254740991 OR typeof(revision) != 'integer' OR revision < 0`).length) invalidDatabase();
  const selections = database.exec("SELECT screen, first_kind, second_kind FROM kind_selections")[0]?.values ?? [];
  if (selections.length !== 3 || new Set(selections.map(row => row[0])).size !== 3 || selections.some(([screen, first, second]) => !["initiative-list", "cost-table", "expansion-table"].includes(String(screen)) || ![1, 2, 3, 4, 5].includes(Number(first)) || (second !== null && (![1, 2, 3, 4, 5].includes(Number(second)) || first === second)) || (screen === "initiative-list" && second !== null) || (screen === "expansion-table" && second === null))) invalidDatabase();
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

export async function createTriadicDatabase(fiscalYear = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0)): Promise<Uint8Array> {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 1 || fiscalYear > 9998) throw new TriadicFileError("年度は1〜9998の整数で入力してください。");
  const sql = await sqlJsPromise;
  const database = new sql.Database();

  try {
    database.exec(TRIADIC_SCHEMA_SQL);
    const now = new Date().toISOString();
    database.run(
      "INSERT INTO budgets (id, fiscal_year, created_at, updated_at) VALUES (1, ?, ?, ?)",
      [fiscalYear, now, now],
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
    assertTriadicDatabase(database);
    return database.export();
  } finally {
    // sql.js reopens its connection on export, resetting connection pragmas.
    database.exec("PRAGMA foreign_keys = ON");
  }
}
