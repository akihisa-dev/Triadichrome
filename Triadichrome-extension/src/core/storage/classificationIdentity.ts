import type { Database } from "./sqliteRuntime";
export type ClassificationTable = "industries" | "departments";
// Existing classifications retain their identity without migrating saved files.
export function classificationIdentity(db: Database, table: ClassificationTable, id: number): string {
  return String(db.exec("SELECT value FROM triadic_metadata WHERE key = ?", [`${table}_identity:${id}`])[0]?.values[0]?.[0] ?? "legacy");
}
export function identifyNewClassification(db: Database, table: ClassificationTable): void {
  const id = Number(db.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
  db.run("INSERT OR REPLACE INTO triadic_metadata (key, value) VALUES (?, ?)", [`${table}_identity:${id}`, crypto.randomUUID()]);
}
