import { BUSINESS_TABLES } from "./triadicSchema";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { trackHistoryChange, createBusinessSnapshot } from "./dataHistory";
import type { Database, SqlValue } from "./sqliteRuntime";

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function readRebaseRows(database: Database, table: string): Map<string, SqlValue[]> {
  const columns = database.exec(`PRAGMA table_info(${table})`)[0]?.values ?? [];
  const keys = columns.map((column, index) => ({ index, order: Number(column[5]) })).filter(key => key.order).sort((a,b) => a.order-b.order).map(key => key.index);
  const account = columns.findIndex(column => column[1] === "account_id"), group = columns.findIndex(column => column[1] === "group_id");
  const membership = table === "aggregation_members";
  if (membership ? account < 0 || group < 0 : !keys.length) throw new Error("統合対象の行識別子がありません。");
  const result = new Map<string, SqlValue[]>();
  for (const row of database.exec(`SELECT * FROM ${table}`)[0]?.values ?? []) {
    let values: SqlValue[];
    if (membership) {
      if ((row[account] === null) === (row[group] === null)) throw new Error("所属対象の識別子が不正です。");
      values = row[account] === null ? ["group",row[group]!] : ["account",row[account]!];
    } else values = keys.map(index => row[index]!);
    if (values.some(value => typeof value !== "string" && (typeof value !== "number" || !Number.isSafeInteger(value)))) throw new Error("統合対象の行識別子が不正です。");
    const key = JSON.stringify(values);
    if (result.has(key)) throw new Error("統合対象の行識別子が重複しています。");
    result.set(key,row);
  }
  return result;
}
/** Merge only independent rows. Any ambiguous edit or invalid combined document stays unsaved. */
export async function rebasePlan(baseBytes: Uint8Array, editedBytes: Uint8Array, currentBytes: Uint8Array) {
  const databases: Database[] = [];
  try {
    for (const bytes of [baseBytes, editedBytes, currentBytes]) databases.push(await openTriadicDatabase(bytes));
    const [base, edited, current] = databases as [Database, Database, Database];
    const identity = (db: Database) => db.exec("SELECT fiscal_year, created_at FROM document_info")[0]?.values;
    if (!equal(identity(base), identity(current))) return null;
    const replacements = new Map<string, SqlValue[][]>();
    for (const table of BUSINESS_TABLES) {
      if (table === "document_info") continue;
      const original = readRebaseRows(base, table), local = readRebaseRows(edited, table), latest = readRebaseRows(current, table);
      let changed = false;
      for (const key of new Set([...original.keys(), ...local.keys()])) {
        const before = original.get(key), after = local.get(key), external = latest.get(key);
        if (equal(before, after)) continue;
        if (!equal(before, external) && !equal(after, external)) return null;
        if (equal(after, external)) continue;
        if (after) latest.set(key, after); else latest.delete(key);
        changed = true;
      }
      if (changed) replacements.set(table, [...latest.values()]);
    }
    if (!replacements.size) return { bytes: currentBytes, operation: null };
    // Work on a private copy; disable cascades while replacing full tables, then validate every relationship.
    current.exec("PRAGMA foreign_keys = OFF; BEGIN");
    for (const table of replacements.keys()) current.exec(`DELETE FROM ${table}`);
    for (const [table, values] of replacements) for (const row of values) {
      current.run(`INSERT INTO ${table} VALUES (${row.map(() => "?").join(",")})`, row);
    }
    current.run("UPDATE document_info SET updated_at = ?", [new Date().toISOString()]);
    current.exec("COMMIT; PRAGMA foreign_keys = ON");
    const bytes = await trackHistoryChange(currentBytes, exportTriadicDatabase(current));
    return { bytes, operation: { before: await createBusinessSnapshot(currentBytes), after: await createBusinessSnapshot(bytes) } };
  } catch {
    // Different document, malformed external data, duplicate IDs, or broken references require a separate save.
    return null;
  } finally { for (const database of databases) database.close(); }
}
