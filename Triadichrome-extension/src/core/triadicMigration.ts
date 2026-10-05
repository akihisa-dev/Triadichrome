import type { Database } from "sql.js";
import { validateNormalizedData } from "./migration10";

export function hasColumn(database: Database, table: "accounts" | "initiatives", column: string): boolean {
  return database.exec(`PRAGMA table_info(${table})`)[0]!.values.some(item => item[1] === column);
}
/** Current files require validation only; unsupported versions are never migrated. */
export function migrateTriadicDatabase(database: Database): void {
  if (Number(database.exec("PRAGMA user_version")[0]?.values[0]?.[0]) !== 13) throw new Error("旧保存形式の移行には対応していません。");
  validateNormalizedData(database);
}
