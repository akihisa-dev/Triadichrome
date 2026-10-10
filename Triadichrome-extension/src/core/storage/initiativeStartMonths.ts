import type { Database } from "./sqliteRuntime";
import { deriveStartYearMonth, type InitiativeStartMonths, type StartMonthRule } from "../domain/initiativeStartMonth";
import type { AmountSource } from "../domain/kinds";

function derivedStartMonths(db: Database) {
  const fiscalYear = Number(db.exec("SELECT fiscal_year FROM document_info WHERE id = 1")[0]!.values[0]![0]);
  const owners = new Map<number, AmountSource[]>();
  // Test each amount before grouping: opposite values must remain active.
  // Only month activity is needed, not every account's amount in JavaScript.
  for (const [owner, month, primary, confirmed] of db.exec(`SELECT r.initiative_id, m.month,
    MAX(m.amount_yen != 0), MAX(COALESCE(o.amount_yen, m.amount_yen) != 0)
    FROM initiative_rows r JOIN initiative_amounts m ON m.row_id = r.id
    LEFT JOIN amount_overrides o ON o.row_id = r.id AND o.month = m.month
    GROUP BY r.initiative_id, m.month`)[0]?.values ?? []) {
    let source = owners.get(Number(owner));
    if (!source) { source = [{ amounts: {}, overrides: { 2: {} } }]; owners.set(Number(owner), source); }
    source[0]!.amounts[Number(month)] = String(primary);
    source[0]!.overrides![2]![Number(month)] = String(confirmed);
  }
  return (db.exec(`SELECT i.id, p.start_month_rule, i.primary_start_year_month, i.confirmed_start_year_month
    FROM initiatives i LEFT JOIN period_types p ON p.id = i.period_type_id`)[0]?.values ?? []).map(([id, rule, primary, confirmed]) => {
    const source = owners.get(Number(id)) ?? [];
    const values: InitiativeStartMonths = {
      1: deriveStartYearMonth(fiscalYear, rule as StartMonthRule | null, source, 1),
      2: deriveStartYearMonth(fiscalYear, rule as StartMonthRule | null, source, 2),
    };
    return { id: Number(id), primary, confirmed, values };
  });
}

/** Persist both kinds in the same transaction as the source edit. */
export function syncInitiativeStartMonths(db: Database): void {
  for (const { id, primary, confirmed, values } of derivedStartMonths(db)) {
    if (primary !== values[1] || confirmed !== values[2]) db.run(
      "UPDATE initiatives SET primary_start_year_month = ?, confirmed_start_year_month = ?, revision = revision + 1 WHERE id = ?",
      [values[1], values[2], id]);
  }
}

export function validateInitiativeStartMonths(db: Database): void {
  if (derivedStartMonths(db).some(({ primary, confirmed, values }) => primary !== values[1] || confirmed !== values[2])) {
    throw new Error("開始年月が期間分類・月別金額と一致しません。");
  }
}
