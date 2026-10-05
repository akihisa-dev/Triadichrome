import { KIND_MASTER_SQL } from "./kindMasterSchema";
import { SINGLE_YEAR_SQL } from "./singleYearSchema";
import { NORMALIZED_TABLES_SQL, normalizedViews } from "./normalizedSchema";
import { PERIOD_MASTER_SQL } from "./periodMasterSchema";
import { DEPARTMENT_SQL } from "./departmentSchema";
import { INDUSTRY_SQL } from "./industrySchema";
import { EXPANSION_SQL } from "./expansionSchema";
import { AGGREGATION_SQL } from "./aggregationSchema";

export const TRIADIC_FILE_EXTENSION = ".triadic";
export const TRIADIC_MIME_TYPE = "application/vnd.triadichrome+sqlite";
export const TRIADIC_FORMAT_ID = "triadichrome";
export const TRIADIC_FORMAT_VERSION = 13;
// Nullable only for accounts in older files, whose codes must be assigned by the user.
export const ACCOUNT_CODE_COLUMN_SQL = "code TEXT CHECK (code IS NULL OR code GLOB '[0-9][0-9][0-9]')";

export const TRIADIC_SCHEMA_OBJECTS = [
  { type: "table", name: "triadic_metadata" },
  { type: "table", name: "budgets" },
  { type: "table", name: "periods" },
  { type: "table", name: "initiatives" },
  { type: "table", name: "accounts" },
  { type: "table", name: "details" },
  { type: "view", name: "detail_view" },
  { type: "view", name: "cost_view" },
  { type: "view", name: "expansion_view" },
] as const;

export const INITIATIVE_ROWS_SQL = `CREATE TABLE initiative_rows (
  id INTEGER PRIMARY KEY,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  sort_order INTEGER NOT NULL
);
CREATE INDEX initiative_rows_initiative_idx ON initiative_rows (initiative_id);
`;

export const DETAILS_SQL = `CREATE TABLE details (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_row_id INTEGER REFERENCES initiative_rows(id) ON DELETE CASCADE,
  budget_amount REAL NOT NULL DEFAULT 0,
  actual_amount REAL NOT NULL DEFAULT 0,
  budget_sales_amount REAL NOT NULL DEFAULT 0,
  actual_sales_amount REAL NOT NULL DEFAULT 0,
  budget_profit_amount REAL NOT NULL DEFAULT 0,
  actual_profit_amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  UNIQUE (period_id, entry_row_id)
);

CREATE INDEX details_period_idx ON details (budget_id, period_id);
CREATE INDEX details_initiative_idx ON details (budget_id, initiative_id);
CREATE INDEX details_account_idx ON details (budget_id, account_id);

`;

export const TRIADIC_VIEWS_SQL = `CREATE VIEW detail_view AS
SELECT
  d.id,
  d.period_id,
  d.initiative_id,
  d.account_id,
  d.budget_id,
  p.year,
  p.month,
  i.name AS initiative_name,
  a.name AS account_name,
  d.budget_amount,
  d.actual_amount,
  CASE a.attribute
    WHEN 'sales' THEN d.budget_amount WHEN 'cost' THEN -d.budget_amount
    WHEN 'expense' THEN 0 WHEN 'profit' THEN 0 END AS budget_sales_amount,
  d.actual_sales_amount,
  CASE a.attribute
    WHEN 'sales' THEN d.budget_amount WHEN 'cost' THEN -d.budget_amount
    WHEN 'expense' THEN -d.budget_amount WHEN 'profit' THEN d.budget_amount END AS budget_profit_amount,
  d.actual_profit_amount,
  d.note
FROM details AS d
JOIN periods AS p ON p.id = d.period_id
JOIN initiatives AS i ON i.id = d.initiative_id
JOIN accounts AS a ON a.id = d.account_id;

CREATE VIEW cost_view AS
SELECT
  d.budget_id,
  d.period_id,
  p.year,
  p.month,
  d.account_id,
  a.name AS account_name,
  ROUND(SUM(d.budget_amount), 3) AS budget_amount,
  SUM(d.actual_amount) AS actual_amount,
  CASE WHEN COUNT(*) = COUNT(d.budget_sales_amount) THEN ROUND(SUM(d.budget_sales_amount), 3) END AS budget_sales_amount,
  SUM(d.actual_sales_amount) AS actual_sales_amount,
  CASE WHEN COUNT(*) = COUNT(d.budget_profit_amount) THEN ROUND(SUM(d.budget_profit_amount), 3) END AS budget_profit_amount,
  SUM(d.actual_profit_amount) AS actual_profit_amount
FROM detail_view AS d
JOIN periods AS p ON p.id = d.period_id
JOIN accounts AS a ON a.id = d.account_id
GROUP BY d.budget_id, d.period_id, d.account_id;

CREATE VIEW expansion_view AS
SELECT
  d.budget_id,
  d.period_id,
  p.year,
  p.month,
  d.initiative_id,
  i.name AS initiative_name,
  CASE WHEN COUNT(*) = COUNT(d.budget_sales_amount) THEN ROUND(SUM(d.budget_sales_amount), 3) END AS budget_sales_amount,
  SUM(d.actual_sales_amount) AS actual_sales_amount,
  CASE WHEN COUNT(*) = COUNT(d.budget_profit_amount) THEN ROUND(SUM(d.budget_profit_amount), 3) END AS budget_profit_amount,
  SUM(d.actual_profit_amount) AS actual_profit_amount
FROM detail_view AS d
JOIN periods AS p ON p.id = d.period_id
JOIN initiatives AS i ON i.id = d.initiative_id
GROUP BY d.budget_id, d.period_id, d.initiative_id;
`;

export const LEGACY_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA user_version = 9;

CREATE TABLE triadic_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT INTO triadic_metadata (key, value) VALUES
  ('format_id', '${TRIADIC_FORMAT_ID}'),
  ('format_version', '9'),
  ('container', 'sqlite');

CREATE TABLE budgets (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE periods (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 9999),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  UNIQUE (budget_id, year, month)
);

CREATE TABLE initiatives (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  expansion_id INTEGER REFERENCES expansions(id),
  department_id INTEGER REFERENCES departments(id),
  period_type_id INTEGER REFERENCES period_types(id),
  fiscal_year INTEGER CHECK (fiscal_year BETWEEN 1 AND 9998),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (budget_id, name)
);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  ${ACCOUNT_CODE_COLUMN_SQL},
  attribute TEXT CHECK (attribute IN ('sales', 'cost', 'expense', 'profit')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (budget_id, name)
);

CREATE UNIQUE INDEX accounts_code_idx ON accounts (budget_id, code);

${PERIOD_MASTER_SQL}
${DEPARTMENT_SQL}
${INDUSTRY_SQL}
${EXPANSION_SQL}
${AGGREGATION_SQL}
ALTER TABLE aggregation_groups ADD COLUMN display_name TEXT CHECK (display_name IS NULL OR length(trim(display_name)) > 0);
${INITIATIVE_ROWS_SQL}
${DETAILS_SQL}
${TRIADIC_VIEWS_SQL}
`;

// New files use the normalized structure; legacy definitions remain migration inputs.
export const TRIADIC_SCHEMA_SQL = LEGACY_SCHEMA_SQL + `
DROP VIEW expansion_view; DROP VIEW cost_view; DROP VIEW detail_view;
DROP TABLE details; DROP TABLE initiative_rows; DROP TABLE initiatives;
${NORMALIZED_TABLES_SQL}
${normalizedViews(TRIADIC_VIEWS_SQL)}
ALTER TABLE initiatives ADD COLUMN industry_id INTEGER REFERENCES industries(id) ON DELETE RESTRICT;
CREATE INDEX initiatives_industry_idx ON initiatives(industry_id);
${KIND_MASTER_SQL}
PRAGMA user_version = 12;
UPDATE triadic_metadata SET value = '12' WHERE key = 'format_version';
` + SINGLE_YEAR_SQL;
