import { validateMasterPresentation } from "./masterPresentation";
import { initializeSqlite, type Database } from "./sqliteRuntime";
import { listAggregations } from "./aggregations";
import { validateAggregations } from "../domain/aggregations";
import { validateDataHistory, DATA_HISTORY_SQL } from "./dataHistorySchema";
import { seedDefaultCostMaster } from "./defaultCostMaster";
import { validateInitiativeStartMonths } from "./initiativeStartMonths";
import { BUSINESS_TABLES, TRIADIC_FORMAT_ID, TRIADIC_FORMAT_VERSION, TRIADIC_SCHEMA_SQL } from "./triadicSchema";
export { TRIADIC_FILE_EXTENSION, TRIADIC_MIME_TYPE } from "./triadicSchema";
const allowedSchemas = new Map<DocumentType, string>();
const schemaObjects = (db: Database) => db.exec("SELECT type, name, tbl_name, sql FROM main.sqlite_master ORDER BY type, name")[0]?.values ?? [];
const sqlitePromise = initializeSqlite().then(sql => {
  // Derive both exact allowlists from the authoritative DDL, including SQLite's internal objects.
  for (const type of ["plan", "snapshot"] as const) {
    const canonical = new sql.Database();
    try {
      canonical.exec(TRIADIC_SCHEMA_SQL);
      if (type === "plan") canonical.exec(DATA_HISTORY_SQL);
      allowedSchemas.set(type, JSON.stringify(schemaObjects(canonical)));
    } finally { canonical.close(); }
  }
  return sql;
});
export class TriadicFileError extends Error {
  constructor(message: string) { super(message); this.name = "TriadicFileError"; }
}
function invalid(): never { throw new TriadicFileError("Triadicファイルの形式が正しくありません。"); }
type DocumentType = "plan" | "snapshot";
function assertDatabase(db: Database, documentType: DocumentType): void {
  if (db.exec("PRAGMA user_version")[0]?.values[0]?.[0] !== TRIADIC_FORMAT_VERSION) {
    throw new TriadicFileError("この保存形式には対応していません。基準年度を指定して新しいファイルを作成してください。");
  }
  // Inspect the schema before querying any business object. Never execute supplied definitions.
  db.exec("PRAGMA trusted_schema = OFF");
  const objects = schemaObjects(db);
  if (documentType === "snapshot" && objects.some(([type, name]) => type === "table" && (name === "data_history" || name === "data_history_state"))) {
    throw new Error("履歴の中に履歴を含めることはできません。");
  }
  if (JSON.stringify(objects) !== allowedSchemas.get(documentType)
    || db.exec("SELECT name FROM temp.sqlite_master").length) {
    throw new TriadicFileError("このファイルの形式には許可されていない保存構造が含まれています。元のファイルは変更していません。");
  }
  const metadata = new Map((db.exec("SELECT key, value FROM triadic_metadata")[0]?.values ?? []).map(([key, value]) => [String(key), String(value)]));
  if (metadata.get("format_id") !== TRIADIC_FORMAT_ID || metadata.get("format_version") !== String(TRIADIC_FORMAT_VERSION)
    || metadata.get("container") !== "sqlite") invalid();
  const tables = new Set((db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values ?? []).map(([name]) => String(name)));
  if (!BUSINESS_TABLES.every(name => tables.has(name))) invalid();
  if (documentType === "snapshot") {
    if (tables.has("data_history") || tables.has("data_history_state")) throw new Error("履歴の中に履歴を含めることはできません。");
  } else {
    if (!tables.has("data_history") || !tables.has("data_history_state")) invalid();
    validateDataHistory(db);
  }
  if (metadata.get("document_type") !== documentType) invalid();
  const documentInfo = db.exec("SELECT id, fiscal_year, created_at, updated_at FROM document_info")[0]?.values ?? [];
  if (documentInfo.length !== 1 || documentInfo[0]?.[0] !== 1 || !Number.isInteger(documentInfo[0]?.[1]) || Number(documentInfo[0]?.[1]) < 1 || Number(documentInfo[0]?.[1]) > 9998) invalid();
  if (db.exec("PRAGMA integrity_check")[0]?.values[0]?.[0] !== "ok" || db.exec("PRAGMA foreign_key_check").length) invalid();
  if (db.exec(`SELECT id FROM accounts WHERE typeof(code) != 'text' OR code NOT GLOB '[0-9][0-9][0-9]' OR attribute NOT IN ('sales','cost','expense','profit') OR trim(name) = ''
    UNION ALL SELECT id FROM expansions WHERE typeof(code) != 'text' OR code = '' OR code GLOB '*[^0-9]*' OR trim(name) = ''
    UNION ALL SELECT id FROM industries WHERE typeof(code) != 'text' OR code = '' OR code GLOB '*[^0-9]*' OR trim(name) = ''
    UNION ALL SELECT id FROM departments WHERE trim(name) = '' UNION ALL SELECT id FROM period_types WHERE trim(name) = ''`).length) invalid();
  for (const table of ["accounts", "expansions", "industries", "departments", "period_types", "initiatives"]) {
    if (db.exec(`SELECT name FROM ${table} GROUP BY name HAVING COUNT(*) > 1`).length) invalid();
  }
  for (const table of ["accounts", "expansions", "industries"]) {
    if (db.exec(`SELECT code FROM ${table} GROUP BY code HAVING COUNT(*) > 1`).length) invalid();
  }
  if (db.exec(`SELECT id FROM initiatives WHERE trim(name) = '' OR expansion_id IS NULL OR industry_id IS NULL OR department_id IS NULL
    UNION ALL SELECT id FROM initiative_rows WHERE typeof(id) != 'text' OR id = ''
    UNION ALL SELECT r.id FROM initiative_rows r LEFT JOIN initiative_amounts m ON m.row_id = r.id GROUP BY r.id HAVING COUNT(m.month) != 12 OR COUNT(DISTINCT m.month) != 12`).length) throw new Error("各入力行には12か月分の明細が必要です。");
  for (const table of ["initiatives", "initiative_rows", "initiative_amounts", "amount_overrides", "previous_amounts"]) {
    if (db.exec(`SELECT revision FROM ${table} WHERE typeof(revision) != 'integer' OR revision < 0`).length) invalid();
  }
  for (const table of ["initiative_amounts", "amount_overrides", "previous_amounts"]) {
    if (db.exec(`SELECT month FROM ${table} WHERE typeof(month) != 'integer' OR month NOT BETWEEN 1 AND 12 OR typeof(amount_yen) != 'integer' OR amount_yen NOT BETWEEN -9007199254740991 AND 9007199254740991`).length) invalid();
  }
  const selections = db.exec("SELECT screen, first_kind, second_kind FROM kind_selections")[0]?.values ?? [];
  if (selections.length !== 3 || new Set(selections.map(row => row[0])).size !== 3 || selections.some(([screen, first, second]) =>
    !["initiative-list", "cost-table", "expansion-table"].includes(String(screen)) || ![1,2].includes(Number(first))
    || (second !== null && (![1,2].includes(Number(second)) || first === second)) || (screen === "initiative-list" && second !== null))) invalid();
  if (db.exec("SELECT id FROM departments WHERE NOT EXISTS (SELECT 1 FROM department_industries WHERE department_id = departments.id)").length) invalid();
  validateMasterPresentation(db);
  validateAggregations(listAggregations(db), new Set((db.exec("SELECT id FROM accounts")[0]?.values ?? []).map(([id]) => Number(id))));
  if (db.exec("SELECT id FROM period_types WHERE start_month_rule IS NOT NULL AND start_month_rule NOT IN ('new', 'period_gap')").length) invalid();
  validateInitiativeStartMonths(db);
}
export async function createTriadicDatabase(fiscalYear = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0)): Promise<Uint8Array> {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 1 || fiscalYear > 9998) throw new TriadicFileError("年度は1〜9998の整数で入力してください。");
  const sql = await sqlitePromise;
  const db = new sql.Database();
  try {
    db.exec(TRIADIC_SCHEMA_SQL);
    const now = new Date().toISOString();
    db.run("INSERT INTO document_info VALUES (1, ?, ?, ?)", [fiscalYear, now, now]);
    db.run("INSERT INTO triadic_metadata VALUES ('document_type', 'plan')");
    db.exec(DATA_HISTORY_SQL);
    db.run("INSERT INTO data_history_state VALUES (1, 1, 1, NULL, ?)", [now]);
    seedDefaultCostMaster(db);
    return exportTriadicDatabase(db);
  } finally { db.close(); }
}
async function openDatabase(data: ArrayLike<number>, type: DocumentType): Promise<Database> {
  const sql = await sqlitePromise;
  let db: Database | undefined;
  try { db = new sql.Database(data); assertDatabase(db, type); db.exec("PRAGMA foreign_keys = ON"); return db; }
  catch (error) {
    db?.close();
    if (error instanceof TriadicFileError || error instanceof Error && /履歴の中/.test(error.message)) throw error;
    throw new TriadicFileError("Triadicファイルを読み込めませんでした。");
  }
}
/** The caller always closes the private connection. */
export const openTriadicDatabase = (data: ArrayLike<number>) => openDatabase(data, "plan");
export const openBusinessSnapshot = (data: ArrayLike<number>) => openDatabase(data, "snapshot");
export async function validateTriadicDatabase(data: ArrayLike<number>): Promise<void> { const db = await openTriadicDatabase(data); db.close(); }
function exportDatabase(db: Database, type: DocumentType): Uint8Array {
  try { assertDatabase(db, type); return db.export(); }
  finally { db.exec("PRAGMA foreign_keys = ON"); }
}
export const exportTriadicDatabase = (db: Database) => exportDatabase(db, "plan");
export const exportBusinessSnapshot = (db: Database) => exportDatabase(db, "snapshot");
