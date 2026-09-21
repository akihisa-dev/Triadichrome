import type { Database, QueryExecResult } from "sql.js";

export type NamedItem = { id: number; name: string };
export type ItemKind = "initiative" | "account";
export type BudgetData = {
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
  | { type: "month"; month: string };

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
    name: String(database.exec("SELECT name FROM budgets WHERE id = 1")[0]?.values[0]?.[0] ?? ""),
    initiatives: items(database, "initiative"),
    accounts: items(database, "account"),
    months: (database.exec("SELECT printf('%04d-%02d', year, month) FROM periods WHERE budget_id = 1 ORDER BY year, month")[0]?.values ?? []).map(([month]) => String(month)),
    detail: table(database, `SELECT v.year, v.month, v.initiative_name, v.account_name,
      v.budget_amount, v.actual_amount, v.budget_sales_amount, v.actual_sales_amount,
      v.budget_profit_amount, v.actual_profit_amount, v.note
      FROM detail_view v JOIN details d ON d.id = v.id
      JOIN initiatives i ON i.id = d.initiative_id JOIN accounts a ON a.id = d.account_id
      ORDER BY v.year, v.month, i.sort_order, i.id, a.sort_order, a.id`),
    cost: table(database, `SELECT v.year, v.month, v.account_name, v.budget_amount, v.actual_amount
      FROM cost_view v JOIN accounts a ON a.id = v.account_id
      ORDER BY v.year, v.month, a.sort_order, a.id`),
    expansion: table(database, `SELECT v.year, v.month, v.initiative_name,
      v.budget_sales_amount, v.actual_sales_amount, v.budget_profit_amount, v.actual_profit_amount
      FROM expansion_view v JOIN initiatives i ON i.id = v.initiative_id
      ORDER BY v.year, v.month, i.sort_order, i.id`),
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
    if (edit.type === "name") {
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
