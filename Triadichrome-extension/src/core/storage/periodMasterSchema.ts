import { startMonthRuleForName } from "../domain/initiativeStartMonth";
export const INITIAL_PERIOD_TYPES = [
  { id: 1, periodName: "期間差" },
  { id: 2, periodName: "新規" },
] as const;

export const PERIOD_MASTER_SQL = `CREATE TABLE period_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  start_month_rule TEXT CHECK (start_month_rule IN ('new', 'period_gap'))
);
INSERT INTO period_types (id, name, start_month_rule) VALUES
${INITIAL_PERIOD_TYPES.map(item => `(${item.id}, '${item.periodName}', '${startMonthRuleForName(item.periodName)}')`).join(",\n")};`;
