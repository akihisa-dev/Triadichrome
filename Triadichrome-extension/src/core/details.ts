import { INITIAL_KINDS } from "./kindMasterSchema";
import { canChangeAccountRow, kindIds, readPlanSettings, readRowOverrides, resolvedAmount, type AmountSource } from "./kindAmounts";
import { type Database } from "sql.js";
import { amountToYen, yenToAmount } from "./amounts";
import { exportTriadicDatabase, openTriadicDatabase } from "./triadicDatabase";
import { migrateTriadicDatabase } from "./triadicMigration";
import { validateNormalizedData } from "./migration10";

export type DetailRecord = {
  kindId: number; kindName: string; industryId: number | null;
  id: number; rowId: number; initiativeId: number; initiativeName: string; note: string;
  fiscalYear: number; year: number; month: number; expansionId: number | null;
  departmentId: number | null; periodTypeId: number | null; accountId: number;
  accountCode: string | null; accountName: string; accountType: string | null;
  amount: string; sales: string | null; profit: string | null;
  initiativeOrder: number; rowOrder: number; initiativeRevision: number; rowRevision: number; revision: number;
};
export function listDetailRecords(db: Database): DetailRecord[] {
  if (Number(db.exec("PRAGMA user_version")[0]!.values[0]![0]) < 10) return [];
  const primary = (db.exec("SELECT * FROM initiative_detail_view ORDER BY fiscal_year, initiative_order, initiative_id, row_order, row_id, fiscal_month_position")[0]?.values ?? []).map(v => ({
    kindId: 1, kindName: "一次予算", industryId: null, id: Number(v[0]), rowId: Number(v[1]), initiativeId: Number(v[2]), initiativeName: String(v[3]), note: String(v[4]),
    fiscalYear: Number(v[5]), year: Number(v[6]), month: Number(v[7]), expansionId: v[9] === null ? null : Number(v[9]),
    departmentId: v[10] === null ? null : Number(v[10]), periodTypeId: v[11] === null ? null : Number(v[11]),
    accountId: Number(v[12]), accountCode: v[13] === null ? null : String(v[13]), accountName: String(v[14]), accountType: v[15] === null ? null : String(v[15]),
    amount: yenToAmount(Number(v[16])), sales: v[17] === null ? null : yenToAmount(Number(v[17])), profit: v[18] === null ? null : yenToAmount(Number(v[18])),
    initiativeOrder: Number(v[19]), rowOrder: Number(v[20]), initiativeRevision: Number(v[21]), rowRevision: Number(v[22]), revision: Number(v[23]),
  }));
  const settings = readPlanSettings(db);
  const planRevision = Number(db.exec("SELECT revision FROM budgets WHERE id = 1")[0]!.values[0]![0]);
  const classifications = new Map((db.exec("SELECT id, industry_id FROM initiatives")[0]?.values ?? []).map(([id, industry]) => [Number(id), Number(industry)]));
  const sources = new Map<number, AmountSource>();
  for (const record of primary) {
    if (!sources.has(record.rowId)) sources.set(record.rowId, { amounts: {}, overrides: readRowOverrides(db, record.rowId) });
    sources.get(record.rowId)!.amounts[record.month] = record.amount;
  }
  const effect = (amount: string, attribute: string | null) => {
    const yen = amountToYen(amount);
    return { sales: yenToAmount(attribute === "sales" ? yen : attribute === "cost" ? -yen : 0), profit: yenToAmount(attribute === "sales" || attribute === "profit" ? yen : attribute === "cost" || attribute === "expense" ? -yen : 0) };
  };
  const result: DetailRecord[] = primary.flatMap(record => kindIds.map(kind => {
    const amount = resolvedAmount(sources.get(record.rowId)!, kind, record.month);
    return { ...record, id: record.id * 10 + kind, kindId: kind, kindName: INITIAL_KINDS.find(item => item.id === kind)!.kindName,
      industryId: classifications.get(record.initiativeId) ?? null, amount, ...effect(amount, record.accountType), revision: record.revision + planRevision };
  }));
  for (const v of db.exec(`SELECT p.id, p.account_id, p.industry_id, p.department_id, p.month, p.amount_yen, p.revision, a.code, a.name, a.attribute, a.sort_order
    FROM previous_amounts p JOIN accounts a ON a.id = p.account_id ORDER BY p.id`)[0]?.values ?? []) {
    const amount = yenToAmount(Number(v[5]));
    result.push({ id: -Number(v[0]), rowId: -Number(v[0]), initiativeId: 0, initiativeName: "前年", note: "", kindId: 0, kindName: "前年",
      fiscalYear: settings.fiscalYear, year: settings.fiscalYear + (Number(v[4]) < 4 ? 1 : 0), month: Number(v[4]), expansionId: null, departmentId: Number(v[3]), industryId: Number(v[2]), periodTypeId: null,
      accountId: Number(v[1]), accountCode: v[7] === null ? null : String(v[7]), accountName: String(v[8]), accountType: v[9] === null ? null : String(v[9]), amount, ...effect(amount, v[9] === null ? null : String(v[9])),
      initiativeOrder: -1, rowOrder: Number(v[10]), initiativeRevision: 0, rowRevision: 0, revision: Number(v[6]) });
  }
  return result.sort((a, b) => a.initiativeOrder - b.initiativeOrder || a.initiativeId - b.initiativeId || a.rowOrder - b.rowOrder || (a.kindId === 0 ? a.industryId! - b.industryId! || a.departmentId! - b.departmentId! : a.rowId - b.rowId) || ((a.month + 8) % 12) - ((b.month + 8) % 12) || a.kindId - b.kindId || a.id - b.id);

}
export type DetailField = "name" | "note" | "fiscalYear" | "expansionId" | "departmentId" | "periodTypeId" | "industryId" | "accountId" | "amount";
export type DetailChange = { target: Pick<DetailRecord, "id" | "rowId" | "initiativeId" | "initiativeRevision" | "rowRevision" | "revision">; field: DetailField; value: string };

export async function changeDetail(bytes: Uint8Array, change: DetailChange): Promise<Uint8Array> {
  const db = await openTriadicDatabase(bytes);
  try {
    migrateTriadicDatabase(db);
    const current = listDetailRecords(db).find(d => d.id === change.target.id);
    if (!current || current.rowId !== change.target.rowId || current.initiativeId !== change.target.initiativeId) throw new Error("編集対象の明細が一致しません。");
    if (current.initiativeRevision !== change.target.initiativeRevision || current.rowRevision !== change.target.rowRevision || current.revision !== change.target.revision) throw new Error("編集開始後にデータが変更されています。最新の値を確認して編集し直してください。");
    db.run("BEGIN");
    const { field, value } = change;
    if (field === "amount") {
      if (!current.accountType) throw new Error("科目属性をマスタで設定してください。");
      const amount = amountToYen(value || "0");
      if (current.kindId === 0) db.run("UPDATE previous_amounts SET amount_yen = ?, revision = revision + 1 WHERE id = ?", [amount, -current.id]);
      else {
        if (current.kindId === 1) db.run("UPDATE initiative_amounts SET amount_yen = ?, revision = revision + 1 WHERE row_id = ? AND month = ?", [amount, current.rowId, current.month]);
        else db.run(`INSERT INTO amount_overrides (row_id, kind_id, month, amount_yen) VALUES (?, ?, ?, ?)
          ON CONFLICT (row_id, kind_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = amount_overrides.revision + 1`, [current.rowId, current.kindId, current.month, amount]);
        db.run("UPDATE initiative_rows SET revision = revision + 1 WHERE id = ?", [current.rowId]);
      }
    } else if (field === "accountId") {
      if (current.kindId === 0) throw new Error("前年の科目は前年入力画面で選択してください。");
      const source: AmountSource = { amounts: Object.fromEntries((db.exec("SELECT month, amount_yen FROM initiative_amounts WHERE row_id = ?", [current.rowId])[0]?.values ?? []).map(([month, yen]) => [Number(month), yenToAmount(Number(yen))])), overrides: readRowOverrides(db, current.rowId) };
      if (!canChangeAccountRow(source)) throw new Error("全種別・全月の金額が0の行だけ勘定科目を変更できます。");
      const selected = db.exec("SELECT attribute FROM accounts WHERE id = ?", [Number(value)])[0]?.values[0];
      if (!selected?.[0]) throw new Error("属性が設定済みの登録科目を選択してください。");
      db.run("UPDATE initiative_rows SET account_id = ?, revision = revision + 1 WHERE id = ?", [Number(value), current.rowId]);
    } else {
      if (current.kindId === 0) throw new Error("前年の分類は前年入力画面で選択してください。");
      const columns = { name: "name", note: "note", fiscalYear: "fiscal_year", expansionId: "expansion_id", departmentId: "department_id", periodTypeId: "period_type_id", industryId: "industry_id" };
      let savedValue: string | number | null = value;
      if (field === "name") {
        savedValue = value.trim();
        if (!savedValue) throw new Error("施策名を入力してください。");
        if (db.exec("SELECT id FROM initiatives WHERE name = ? AND id != ?", [savedValue, current.initiativeId]).length) throw new Error("同じ施策名が登録されています。");
      } else if (field === "fiscalYear") {
        throw new Error("年度はファイル作成時に固定します。");
      } else if (field !== "note") {
        const tables = { expansionId: "expansions", departmentId: "departments", periodTypeId: "period_types", industryId: "industries" };
        savedValue = value === "" ? null : Number(value);
        if (["expansionId", "departmentId", "industryId"].includes(field) && savedValue === null) throw new Error(`${field === "industryId" ? "業種" : field === "departmentId" ? "部署" : "展開"}名を選択してください。`);
        if (savedValue !== null && !db.exec(`SELECT id FROM ${tables[field]} WHERE id = ?`, [savedValue]).length) throw new Error("登録済みの項目を選択してください。");
      }
      db.run(`UPDATE initiatives SET ${columns[field]} = ?, revision = revision + 1 WHERE id = ?`, [savedValue, current.initiativeId]);
    }
    validateNormalizedData(db);
    db.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    db.run("COMMIT");
    return exportTriadicDatabase(db);
  } finally { db.close(); }
}
