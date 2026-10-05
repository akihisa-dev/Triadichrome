import type { Database } from "sql.js";

const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
export function ensureFiscalPeriods(db: Database, year: number): void {
  for (const month of months) db.run("INSERT OR IGNORE INTO periods (budget_id, year, month) VALUES (1, ?, ?)", [year + (month < 4 ? 1 : 0), month]);
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
