import { type Database, type SqlValue } from "sql.js";
import { amountToYen } from "./amounts";
import { NORMALIZED_TABLES_SQL, normalizedViews } from "./normalizedSchema";
import { TRIADIC_VIEWS_SQL } from "./triadicSchema";

const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
function records(db: Database, sql: string): Record<string, SqlValue>[] {
  const result = db.exec(sql)[0];
  return result?.values.map(values => Object.fromEntries(result.columns.map((column, index) => [column, values[index]!]))) ?? [];
}
export function ensureFiscalPeriods(db: Database, year: number): void {
  for (const month of months) db.run("INSERT OR IGNORE INTO periods (budget_id, year, month) VALUES (1, ?, ?)", [year + (month < 4 ? 1 : 0), month]);
}

/** Runs inside the caller's migration transaction; ambiguous legacy data is never merged. */
export function migrateTo10(db: Database): void {
  const initiatives = records(db, "SELECT * FROM initiatives ORDER BY sort_order, id");
  const rows = records(db, "SELECT * FROM initiative_rows ORDER BY sort_order, id");
  const details = records(db, "SELECT d.*, p.year, p.month FROM details d JOIN periods p ON p.id = d.period_id ORDER BY d.id");
  let nextRowId = rows.reduce((maximum, row) => Math.max(maximum, Number(row.id)), 0) + 1;
  for (const initiative of initiatives) {
    const owned = details.filter(d => d.initiative_id === initiative.id);
    const years = new Set(owned.map(d => Number(d.year) - (Number(d.month) < 4 ? 1 : 0)));
    if (initiative.fiscal_year !== null) years.add(Number(initiative.fiscal_year));
    if (years.size !== 1) throw new Error("年度未設定または複数年度の旧施策があります。元ファイルを保持し、年度を確認してください。");
    initiative.fiscal_year = [...years][0]!;
    for (const detail of owned) {
      if (detail.entry_row_id === null) {
        const candidates = rows.filter(r => r.initiative_id === initiative.id && r.account_id === detail.account_id);
        if (candidates.length > 1) throw new Error("旧明細の入力行を一意に特定できません。別行の明細は統合しません。");
        const row = candidates[0] ?? { id: nextRowId++, initiative_id: initiative.id!, account_id: detail.account_id!, sort_order: rows.filter(r => r.initiative_id === initiative.id).length };
        if (!candidates.length) rows.push(row);
        detail.resolved_row_id = row.id!;
      } else detail.resolved_row_id = detail.entry_row_id!;
      const row = rows.find(r => r.id === detail.resolved_row_id);
      if (!row || row.initiative_id !== initiative.id || row.account_id !== detail.account_id) throw new Error("旧明細と入力行の施策・科目が一致しません。");
      detail.amount_yen = amountToYen(String(detail.budget_amount));
    }
  }
  const keys = new Set<string>();
  for (const d of details) {
    const key = `${d.resolved_row_id}:${d.month}`;
    if (keys.has(key)) throw new Error("同じ入力行・月に複数の旧明細があります。明細をまとめず移行を停止しました。");
    keys.add(key);
  }
  db.exec(`DROP VIEW expansion_view; DROP VIEW cost_view; DROP VIEW detail_view;
    DROP TABLE details; DROP TABLE initiative_rows; DROP TABLE initiatives; ${NORMALIZED_TABLES_SQL}`);
  for (const i of initiatives) db.run(`INSERT INTO initiatives (id, budget_id, name, note, fiscal_year, expansion_id, department_id, period_type_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [i.id!, i.budget_id!, i.name!, i.note!, i.fiscal_year!, i.expansion_id!, i.department_id!, i.period_type_id!, i.sort_order!]);
  for (const r of rows) db.run("INSERT INTO initiative_rows (id, initiative_id, account_id, sort_order) VALUES (?, ?, ?, ?)", [r.id!, r.initiative_id!, r.account_id!, r.sort_order!]);
  const legacyColumns = "id, budget_id, period_id, year, month, initiative_id, account_id, entry_row_id, budget_amount, actual_amount, budget_sales_amount, actual_sales_amount, budget_profit_amount, actual_profit_amount, note".split(", ");
  // Insert all preserved IDs before allocating IDs for the missing months.
  for (const d of details) {
    db.run("INSERT INTO initiative_amounts (id, row_id, month, amount_yen) VALUES (?, ?, ?, ?)", [d.id!, d.resolved_row_id!, d.month!, d.amount_yen!]);
    db.run(`INSERT INTO legacy_detail_payloads (${legacyColumns.join(", ")}) VALUES (${legacyColumns.map(() => "?").join(", ")})`, legacyColumns.map(column => d[column] ?? null));
  }
  for (const i of initiatives) ensureFiscalPeriods(db, Number(i.fiscal_year));
  for (const r of rows) for (const month of months) db.run("INSERT OR IGNORE INTO initiative_amounts (row_id, month, amount_yen) VALUES (?, ?, 0)", [r.id!, month]);
  db.exec(normalizedViews(TRIADIC_VIEWS_SQL));
  db.exec("PRAGMA user_version = 10; UPDATE triadic_metadata SET value = '10' WHERE key = 'format_version';");
}

export function validateNormalizedData(db: Database): void {
  if (db.exec(`SELECT r.id FROM initiative_rows r LEFT JOIN initiative_amounts m ON m.row_id = r.id
    GROUP BY r.id HAVING COUNT(m.id) != 12 OR COUNT(DISTINCT m.month) != 12`).length) throw new Error("各入力行には12か月分の明細が必要です。");
  if (db.exec(`SELECT id FROM initiative_amounts WHERE typeof(month) != 'integer' OR month NOT BETWEEN 1 AND 12
    OR typeof(amount_yen) != 'integer' OR amount_yen NOT BETWEEN -9007199254740991 AND 9007199254740991
    OR typeof(revision) != 'integer' OR revision < 0
    UNION ALL SELECT id FROM initiatives WHERE typeof(fiscal_year) != 'integer' OR fiscal_year NOT BETWEEN 1 AND 9998
    UNION ALL SELECT row_id FROM initiative_amounts GROUP BY row_id, month HAVING COUNT(*) > 1`).length) throw new Error("明細の金額・年月・識別キーが不正です。");
}
