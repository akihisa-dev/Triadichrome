import { amountToYen, yenToAmount } from "../domain/amounts";
import { canChangeAccountRow, type AmountSource } from "../domain/kinds";
import { readRowOverrides } from "./settings";
import { readContents } from "./readPlan";
import { editDatabase } from "./transaction";
import { buildDetails } from "../tables/details";
import { detailKey, type DetailChange } from "../domain/details";
export async function changeDetail(bytes: Uint8Array, change: DetailChange): Promise<Uint8Array> {
  return (await editDatabase(bytes, db => {
    const target = change.target;
    const contents = readContents(db, false);
    const scoped = { ...contents, initiatives: target.source === "initiative" ? contents.initiatives.filter(item => item.id === target.initiativeId) : [], previousAmounts: target.source === "previous" ? contents.previousAmounts.filter(item => item.id === target.previousId) : [] };
    const current = buildDetails(scoped).find(d => d.id === detailKey(target));
    if (!current || current.source !== target.source || (target.source === "initiative" && current.initiativeId !== target.initiativeId)) throw new Error("編集対象の明細が一致しません。");
    if ((target.source === "initiative" && (current.initiativeRevision !== target.initiativeRevision || current.rowRevision !== target.rowRevision)) || current.revision !== target.revision) throw new Error("編集開始後にデータが変更されています。最新の値を確認して編集し直してください。");
    const { field, value } = change;
    if (field === "amount") {
      if (!current.accountType) throw new Error("科目属性をマスタで設定してください。");
      const amount = amountToYen(value || "0");
      if (current.source === "previous") db.run("UPDATE previous_amounts SET amount_yen = ?, revision = revision + 1 WHERE id = ?", [amount, current.previousId]);
      else {
        db.run(`INSERT INTO initiative_amounts (row_id, kind_id, month, amount_yen) VALUES (?, ?, ?, ?)
          ON CONFLICT (row_id, kind_id, month) DO UPDATE SET amount_yen = excluded.amount_yen, revision = initiative_amounts.revision + 1`, [current.rowId, current.kindId, current.month, amount]);
        db.run("UPDATE initiative_rows SET revision = revision + 1 WHERE id = ?", [current.rowId]);
      }
    } else if (field === "accountId") {
      if (current.kindId === 0) throw new Error("前年の科目は前年入力画面で選択してください。");
      const source: AmountSource = { amounts: Object.fromEntries((db.exec("SELECT month, amount_yen FROM initiative_amounts WHERE row_id = ? AND kind_id = 1", [current.rowId])[0]?.values ?? []).map(([month, yen]) => [Number(month), yenToAmount(Number(yen))])), overrides: readRowOverrides(db, current.rowId) };
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
  })).bytes;
}
