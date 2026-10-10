import type { Database } from "./sqliteRuntime";
export type ClassificationTable = "industries" | "departments";
export function classificationIdentity(db: Database, table: ClassificationTable, id: number): string {
  const identity = db.exec(`SELECT identity FROM ${table} WHERE id = ?`, [id])[0]?.values[0]?.[0];
  if (typeof identity !== "string" || !/^[0-9a-f]{32}$/.test(identity)) throw new Error("分類の作成識別子が正しくありません。");
  return identity;
}
