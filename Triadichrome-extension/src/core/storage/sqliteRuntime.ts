import sqlite3InitModule, { type Sqlite3Static, type BindingSpec, type Database as NativeDatabase } from "@sqlite.org/sqlite-wasm";
import wasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";

export type SqlValue = number | string | Uint8Array | null;
export type QueryResult = { columns: string[]; values: SqlValue[][] };
export interface Database {
  exec(sql: string, params?: BindingSpec): QueryResult[];
  run(sql: string, params?: BindingSpec): Database;
  export(): Uint8Array;
  close(): void;
  getRowsModified(): number;
}
// The official loader accepts configuration at runtime; its public type deliberately omits it.
const initialize = sqlite3InitModule as unknown as (options: { locateFile: (name: string) => string }) => Promise<Sqlite3Static>;
let runtime: Promise<{ Database: new (data?: ArrayLike<number>) => Database; version: string }> | undefined;
export function initializeSqlite() {
  return runtime ??= initialize({ locateFile: () => wasmUrl }).then(sqlite => {
    const { capi, wasm } = sqlite;
    if (sqlite.version.libVersion !== "3.53.4") throw new Error("SQLite本体の版が検証済みの版と一致しません。");
    class MemoryDatabase implements Database {
      private db: NativeDatabase;
      constructor(data?: ArrayLike<number>) {
        this.db = new sqlite.oo1.DB(":memory:", "c");
        if (data) {
          try {
            const bytes = Uint8Array.from(data);
            const pointer = wasm.allocFromTypedArray(bytes);
            // FREEONCLOSE transfers ownership even on a non-zero return code. Never free twice.
            const rc = capi.sqlite3_deserialize(this.db.pointer!, "main", pointer, bytes.length, bytes.length,
              capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE);
            this.db.checkRc(rc);
          } catch (error) { this.db.close(); throw error; }
        }
      }
      exec(sql: string, params?: BindingSpec): QueryResult[] {
        const results: QueryResult[] = [];
        const scope = wasm.scopedAllocPush();
        try {
          const ppStmt = wasm.scopedAlloc(8);
          const pTail = ppStmt + 4;
          let pSql = wasm.scopedAllocCString(sql, false);
          while (wasm.peek8(pSql)) {
            wasm.pokePtr(ppStmt, 0); wasm.pokePtr(pTail, 0);
            this.db.checkRc(capi.sqlite3_prepare_v3(this.db.pointer!, pSql, -1, 0, ppStmt, pTail));
            const pointer = wasm.peekPtr(ppStmt);
            pSql = wasm.peekPtr(pTail);
            if (!pointer) continue;
            // Let SQLite parse statement boundaries, including trigger bodies and quoted semicolons.
            let statementSql: string;
            try { statementSql = capi.sqlite3_sql(pointer); }
            finally { capi.sqlite3_finalize(pointer); }
            const stmt = this.db.prepare(statementSql);
            try {
              if (params !== undefined && stmt.parameterCount) { stmt.bind(params); params = undefined; }
              const values: SqlValue[][] = [];
              while (stmt.step()) {
                values.push((stmt.get([]) as (SqlValue | bigint)[]).map(value => {
                  if (typeof value !== "bigint") return value;
                  const integer = Number(value);
                  if (!Number.isSafeInteger(integer)) throw new Error("整数が安全に扱える範囲を超えています。");
                  return integer;
                }));
              }
              if (values.length) results.push({ columns: stmt.getColumnNames(), values });
            } finally { stmt.finalize(); }
          }
          return results;
        } finally { wasm.scopedAllocPop(scope); }
      }
      run(sql: string, params?: BindingSpec): Database { if (params === undefined) this.db.exec(sql); else this.db.exec({ sql, bind: params }); return this; }
      export(): Uint8Array { return capi.sqlite3_js_db_export(this.db.pointer!); }
      close(): void { this.db.close(); }
      getRowsModified(): number { return this.db.changes(); }
    }
    return { Database: MemoryDatabase, version: sqlite.version.libVersion };
  });
}
