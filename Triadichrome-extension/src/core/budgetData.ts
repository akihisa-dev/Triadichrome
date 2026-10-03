import type { Database, QueryExecResult } from "sql.js";

export type NamedItem = { id: number; name: string };
export type ItemKind = "initiative" | "account";
export type PlanLine = { id: number; initiativeId: number; accountId: number; month: string; cost: number; sales: number; note: string };
export type BudgetData = {
  lines: PlanLine[];
  name: string;
  initiatives: NamedItem[];
  accounts: NamedItem[];
  months: string[];
  detail: QueryExecResult;
  cost: QueryExecResult;
  expansion: QueryExecResult;
};

export type BudgetEdit =
  | { type: "name"; name: string }
  | { type: "add"; kind: ItemKind; name: string }
  | { type: "rename"; kind: ItemKind; id: number; name: string }
  | { type: "move"; kind: ItemKind; id: number; targetId: number; after: boolean }
  | { type: "month"; month: string }
  | { type: "removeItem"; kind: ItemKind; id: number }
  | { type: "removeMonth"; month: string }
  | { type: "plan"; line: Omit<PlanLine, "id">; id?: number }
  | { type: "deletePlan"; id: number };

const tables = { initiative: "initiatives", account: "accounts" } as const;

function items(database: Database, kind: ItemKind): NamedItem[] {
  return (database.exec(`SELECT id, name FROM ${tables[kind]} WHERE budget_id = 1 ORDER BY sort_order, id`)[0]?.values ?? [])
    .map(([id, name]) => ({ id: Number(id), name: String(name) }));
}

function table(database: Database, sql: string): QueryExecResult {
  return database.exec(sql)[0] ?? { columns: [], values: [] };
}

export function readBudgetData(database: Database): BudgetData {
  return {
    lines: (database.exec(`SELECT d.id, d.initiative_id, d.account_id, printf('%04d-%02d', p.year, p.month),
      d.budget_amount, d.budget_sales_amount, COALESCE(d.note, '') FROM details d
      JOIN periods p ON p.id = d.period_id JOIN initiatives i ON i.id = d.initiative_id
      JOIN accounts a ON a.id = d.account_id
      WHERE d.budget_id = 1 ORDER BY p.year, p.month, i.sort_order, i.id, a.sort_order, a.id`)[0]?.values ?? [])
      .map(([id, initiativeId, accountId, month, cost, sales, note]) => ({
        id: Number(id), initiativeId: Number(initiativeId), accountId: Number(accountId),
        month: String(month), cost: Number(cost), sales: Number(sales), note: String(note),
      })),
    name: String(database.exec("SELECT name FROM budgets WHERE id = 1")[0]?.values[0]?.[0] ?? ""),
    initiatives: items(database, "initiative"),
    accounts: items(database, "account"),
    months: (database.exec("SELECT printf('%04d-%02d', year, month) FROM periods WHERE budget_id = 1 ORDER BY year, month")[0]?.values ?? []).map(([month]) => String(month)),
    detail: table(database, `SELECT v.year, v.month, v.initiative_name, v.account_name,
      v.budget_amount, v.budget_sales_amount,
      (v.budget_sales_amount - v.budget_amount) AS budget_profit_amount, v.note
      FROM detail_view v JOIN details d ON d.id = v.id
      JOIN initiatives i ON i.id = d.initiative_id JOIN accounts a ON a.id = d.account_id
      ORDER BY v.year, v.month, i.sort_order, i.id, a.sort_order, a.id`),
    cost: table(database, `SELECT v.year, v.month, v.account_name, v.budget_amount, v.budget_sales_amount,
      (v.budget_sales_amount - v.budget_amount) AS budget_profit_amount
      FROM cost_view v JOIN accounts a ON a.id = v.account_id
      ORDER BY v.year, v.month, a.sort_order, a.id`),
    expansion: table(database, `SELECT p.year, p.month, i.name AS initiative_name,
      SUM(d.budget_amount) AS budget_amount, SUM(d.budget_sales_amount) AS budget_sales_amount,
      SUM(d.budget_sales_amount - d.budget_amount) AS budget_profit_amount
      FROM details d JOIN periods p ON p.id = d.period_id JOIN initiatives i ON i.id = d.initiative_id
      WHERE d.budget_id = 1 GROUP BY p.id, i.id ORDER BY p.year, p.month, i.sort_order, i.id`),
  };
}

function requireName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("名前を入力してください。");
  return name;
}

/** All changes, including the update time, either succeed together or are rolled back. */
export function applyBudgetEdit(database: Database, edit: BudgetEdit): void {
  database.exec("BEGIN TRANSACTION");
  try {
    if (edit.type === "plan") {
      const { line } = edit;
      for (const amount of [line.cost, line.sales, line.sales - line.cost]) {
        if (!Number.isFinite(amount) || Math.abs(amount) > 1e12) {
          throw new Error("金額は絶対値1兆以下の数値で入力してください。");
        }
      }
      if ([line.cost, line.sales].some((amount) => Number(amount.toFixed(2)) !== amount)) {
        throw new Error("原価と売上は小数第2位までで入力してください。");
      }
      if (!items(database, "initiative").some((item) => item.id === line.initiativeId) ||
          !items(database, "account").some((item) => item.id === line.accountId)) {
        throw new Error("登録済みの施策と勘定科目を選んでください。");
      }
      const periodId = database.exec("SELECT id FROM periods WHERE budget_id = 1 AND printf('%04d-%02d', year, month) = ?", [line.month])[0]?.values[0]?.[0];
      if (typeof periodId !== "number") throw new Error("登録済みの年月を選んでください。");
      if (edit.id !== undefined && !database.exec("SELECT id FROM details WHERE id = ? AND budget_id = 1", [edit.id])[0]?.values.length) {
        throw new Error("明細が見つかりません。");
      }
      if (database.exec(`SELECT id FROM details WHERE budget_id = 1 AND period_id = ? AND initiative_id = ?
        AND account_id = ? AND id != ?`, [periodId, line.initiativeId, line.accountId, edit.id ?? -1])[0]?.values.length) {
        throw new Error("同じ施策・勘定科目・年月の明細があります。既存の明細を編集してください。");
      }
      const values = [periodId, line.initiativeId, line.accountId, line.cost, line.sales, Number((line.sales - line.cost).toFixed(2)), line.note];
      if (edit.id === undefined) {
        database.run(`INSERT INTO details (budget_id, period_id, initiative_id, account_id,
          budget_amount, budget_sales_amount, budget_profit_amount, note) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`, values);
      } else {
        database.run(`UPDATE details SET period_id = ?, initiative_id = ?, account_id = ?,
          budget_amount = ?, budget_sales_amount = ?, budget_profit_amount = ?, note = ? WHERE budget_id = 1 AND id = ?`, [...values, edit.id]);
      }
    } else if (edit.type === "deletePlan") {
      // Existing actual data is outside the planning editor's scope.
      if (database.exec(`SELECT id FROM details WHERE id = ? AND
        (actual_amount != 0 OR actual_sales_amount != 0 OR actual_profit_amount != 0)`, [edit.id])[0]?.values.length) {
        throw new Error("この明細には既存の実績データがあるため削除できません。");
      }
      database.run("DELETE FROM details WHERE budget_id = 1 AND id = ?", [edit.id]);
      if (!database.getRowsModified()) throw new Error("明細が見つかりません。");
    } else if (edit.type === "removeItem" || edit.type === "removeMonth") {
      const targetTable = edit.type === "removeItem" ? tables[edit.kind] : "periods";
      const id = edit.type === "removeItem" ? edit.id : database.exec(
        "SELECT id FROM periods WHERE budget_id = 1 AND printf('%04d-%02d', year, month) = ?", [edit.month])[0]?.values[0]?.[0];
      if (typeof id !== "number") throw new Error("項目が見つかりません。");
      const column = edit.type === "removeMonth" ? "period_id" : edit.kind === "initiative" ? "initiative_id" : "account_id";
      if (database.exec(`SELECT id FROM details WHERE ${column} = ? LIMIT 1`, [id])[0]?.values.length) {
        throw new Error("明細で使用中です。先に明細を移動または削除してください。");
      }
      database.run(`DELETE FROM ${targetTable} WHERE budget_id = 1 AND id = ?`, [id]);
      if (!database.getRowsModified()) throw new Error("項目が見つかりません。");
    } else if (edit.type === "name") {
      database.run("UPDATE budgets SET name = ? WHERE id = 1", [requireName(edit.name)]);
    } else if (edit.type === "month") {
      if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(edit.month)) {
        throw new Error("年月を正しく入力してください。");
      }
      const [year, month] = edit.month.split("-").map(Number);
      if (database.exec("SELECT id FROM periods WHERE budget_id = 1 AND year = ? AND month = ?", [year!, month!])[0]?.values.length) {
        throw new Error("その年月は登録済みです。");
      }
      database.run("INSERT INTO periods (budget_id, year, month) VALUES (1, ?, ?)", [year!, month!]);
    } else {
      const current = items(database, edit.kind);
      const targetTable = tables[edit.kind];
      if (edit.type === "move") {
        const source = current.find((item) => item.id === edit.id);
        if (!source || !current.some((item) => item.id === edit.targetId)) {
          throw new Error("移動する項目が見つかりません。");
        }
        if (edit.id !== edit.targetId) {
          const ordered = current.filter((item) => item.id !== edit.id);
          const targetIndex = ordered.findIndex((item) => item.id === edit.targetId);
          ordered.splice(targetIndex + (edit.after ? 1 : 0), 0, source);
          ordered.forEach((item, index) => {
            database.run(`UPDATE ${targetTable} SET sort_order = ? WHERE id = ? AND budget_id = 1`, [index, item.id]);
          });
        }
      } else {
        const name = requireName(edit.name);
        if (current.some((item) => item.name === name && (edit.type === "add" || item.id !== edit.id))) {
          throw new Error("同じ名前が登録されています。");
        }
        if (edit.type === "add") {
          database.run(`INSERT INTO ${targetTable} (budget_id, name, sort_order)
            SELECT 1, ?, COALESCE(MAX(sort_order), -1) + 1 FROM ${targetTable} WHERE budget_id = 1`, [name]);
        } else {
          if (!current.some((item) => item.id === edit.id)) throw new Error("項目が見つかりません。");
          database.run(`UPDATE ${targetTable} SET name = ? WHERE id = ? AND budget_id = 1`, [name, edit.id]);
        }
      }
    }
    database.run("UPDATE budgets SET updated_at = ? WHERE id = 1", [new Date().toISOString()]);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
