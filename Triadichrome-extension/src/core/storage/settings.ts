import { classificationIdentity } from "./classificationIdentity";
import type { Database } from "./sqliteRuntime";
import { amountToYen, yenToAmount } from "../domain/amounts";
import { editDatabase } from "./transaction";
import { isKindId, type KindId, type KindSelections, type KindScreen, type PlanSettings, type KindOverrides, type PlanChange, type PreviousInput } from "../domain/kinds";
export function readPlanSettings(db: Database): PlanSettings {
  const [year] = db.exec("SELECT fiscal_year FROM document_info WHERE id = 1")[0]!.values[0]!;
  const kindSelections: KindSelections = { "initiative-list": [2], "cost-table": [1], "expansion-table": [1] };
  for (const [screen, first, second] of db.exec("SELECT screen, first_kind, second_kind FROM kind_selections")[0]?.values ?? []) {
    kindSelections[String(screen) as KindScreen] = [Number(first) as KindId, ...(second === null ? [] : [Number(second) as KindId])];
  }
  const previousAmounts = (db.exec("SELECT account_id, industry_id, department_id, month, amount_yen, revision, id FROM previous_amounts ORDER BY industry_id, department_id, account_id, month")[0]?.values ?? [])
    .map(([account, industry, department, month, amount, revision, id]) => ({ accountId: Number(account), industryId: Number(industry), departmentId: Number(department), month: Number(month), amount: yenToAmount(Number(amount)), revision: Number(revision), id: Number(id) }));
  return { fiscalYear: Number(year), kindSelections, previousAmounts };
}
export function readRowOverrides(db: Database, rowId: string): KindOverrides {
  const result: KindOverrides = {};
  for (const [month, amount] of db.exec("SELECT month, amount_yen FROM amount_overrides WHERE row_id = ?", [rowId])[0]?.values ?? []) {
    const id = 2;
    (result[id] ??= {})[Number(month)] = yenToAmount(Number(amount));
  }
  return result;
}

export async function saveKindSelection(bytes: Uint8Array, screen: KindScreen, selected: KindId[]): Promise<Uint8Array> {
  if (!["initiative-list", "cost-table", "expansion-table"].includes(screen)) throw new Error("表示対象が正しくありません。");
  const maximum = screen === "initiative-list" ? 1 : 2;
  if (selected.length < 1 || selected.length > maximum || new Set(selected).size !== selected.length || selected.some(id => !isKindId(id))) throw new Error("種別の選択が正しくありません。");
  return (await editDatabase(bytes, db => db.run("UPDATE kind_selections SET first_kind = ?, second_kind = ? WHERE screen = ?", [selected[0]!, selected[1] ?? null, screen]))).bytes;
}
export async function changePlanSettings(bytes: Uint8Array, change: PlanChange): Promise<Uint8Array> {
  if (change.type === "previous") return savePreviousAmounts(bytes, change.input);
  if (change.type === "previous-import") return (await editDatabase(bytes, db => {
    const seen = new Set<string>();
    if (!change.patches.length) throw new Error("変更する金額がありません。");
    for (const patch of change.patches) {
      const key = `${patch.industryId}:${patch.departmentId}:${patch.accountId}:${patch.month}`;
      if (seen.has(key) || !Number.isInteger(patch.month) || patch.month < 1 || patch.month > 12) throw new Error("取り込み対象が重複しているか、月が正しくありません。");
      seen.add(key);
      if (!db.exec("SELECT id FROM industries WHERE id = ?", [patch.industryId]).length || !db.exec("SELECT id FROM departments WHERE id = ?", [patch.departmentId]).length || !db.exec("SELECT id FROM accounts WHERE id = ?", [patch.accountId]).length) throw new Error("取り込み対象のマスタが見つかりません。");
      if (classificationIdentity(db, "industries", patch.industryId) !== patch.industryIdentity ||
        classificationIdentity(db, "departments", patch.departmentId) !== patch.departmentIdentity) throw new Error("確認後に業種・部署が作り直されています。フォーマットを出力し直してください。");
      const current = db.exec("SELECT amount_yen FROM previous_amounts WHERE industry_id = ? AND department_id = ? AND account_id = ? AND month = ?", [patch.industryId, patch.departmentId, patch.accountId, patch.month])[0]?.values[0]?.[0] ?? 0;
      if (Number(current) !== amountToYen(patch.before)) throw new Error("確認後に前年金額が変更されています。ファイルを選び直してください。");
      const amount = amountToYen(patch.after);
      db.run(`INSERT INTO previous_amounts (account_id, industry_id, department_id, month, amount_yen) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (account_id, industry_id, department_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = previous_amounts.revision + 1`, [patch.accountId, patch.industryId, patch.departmentId, patch.month, amount]);
    }
  })).bytes;
  return saveKindSelection(bytes, change.screen, change.selected);
}
export async function savePreviousAmounts(bytes: Uint8Array, input: PreviousInput): Promise<Uint8Array> {
  if (input.invalidNumbers) throw new Error("金額に有効な数値を入力してください。");
  if (new Set(input.rows.map(row => row.accountId)).size !== input.rows.length) throw new Error("同じ勘定科目が重複しています。");
  return (await editDatabase(bytes, db => {
    if (!db.exec("SELECT id FROM industries WHERE id = ?", [input.industryId]).length) throw new Error("業種名を選択してください。");
    if (!db.exec("SELECT id FROM departments WHERE id = ?", [input.departmentId]).length) throw new Error("部署名を選択してください。");
    for (const row of input.rows) {
      if (!db.exec("SELECT id FROM accounts WHERE id = ?", [row.accountId]).length) throw new Error("勘定科目が見つかりません。");
      for (const [month, text] of Object.entries(row.amounts)) {
        const amount = amountToYen(text || "0");
        db.run(`INSERT INTO previous_amounts (account_id, industry_id, department_id, month, amount_yen) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (account_id, industry_id, department_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = previous_amounts.revision + 1`, [row.accountId, input.industryId, input.departmentId, Number(month), amount]);
      }
    }
  })).bytes;
}
