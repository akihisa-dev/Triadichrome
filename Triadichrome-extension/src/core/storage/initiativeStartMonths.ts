import type { Database } from "./sqliteRuntime";
import { deriveStartYearMonth, type InitiativeStartMonths, type StartMonthRule } from "../domain/initiativeStartMonth";
import { yenToAmount } from "../domain/amounts";
import type { AmountSource } from "../domain/kinds";

function derivedStartMonths(db: Database) {
  const fiscalYear = Number(db.exec("SELECT fiscal_year FROM plan WHERE id = 1")[0]!.values[0]![0]);
  const owners = new Map<number, AmountSource[]>();
  const rows = new Map<string, AmountSource>();
  for (const [id, owner, month, amount, manual] of db.exec(`SELECT r.id, r.initiative_id, m.month, m.amount_yen, o.amount_yen
    FROM initiative_rows r JOIN initiative_amounts m ON m.row_id = r.id
    LEFT JOIN amount_overrides o ON o.row_id = r.id AND o.month = m.month`)[0]?.values ?? []) {
    let row = rows.get(String(id));
    if (!row) {
      row = { amounts: {}, overrides: { 2: {} } }; rows.set(String(id), row);
      const owned = owners.get(Number(owner)) ?? []; owned.push(row); owners.set(Number(owner), owned);
    }
    row.amounts[Number(month)] = yenToAmount(Number(amount));
    if (manual !== null) row.overrides![2]![Number(month)] = yenToAmount(Number(manual));
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
