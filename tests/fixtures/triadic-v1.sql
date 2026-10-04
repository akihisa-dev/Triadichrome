PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE triadic_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT INTO triadic_metadata (key, value) VALUES
  ('format_id', 'triadichrome'),
  ('format_version', '1'),
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
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (budget_id, name)
);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  code TEXT CHECK (code IS NULL OR code GLOB '[0-9][0-9][0-9]'),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (budget_id, name)
);

CREATE UNIQUE INDEX accounts_code_idx ON accounts (budget_id, code);

CREATE TABLE details (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  budget_amount REAL NOT NULL DEFAULT 0,
  actual_amount REAL NOT NULL DEFAULT 0,
  budget_sales_amount REAL NOT NULL DEFAULT 0,
  actual_sales_amount REAL NOT NULL DEFAULT 0,
  budget_profit_amount REAL NOT NULL DEFAULT 0,
  actual_profit_amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  UNIQUE (budget_id, period_id, initiative_id, account_id)
);

CREATE INDEX details_period_idx ON details (budget_id, period_id);
CREATE INDEX details_initiative_idx ON details (budget_id, initiative_id);
CREATE INDEX details_account_idx ON details (budget_id, account_id);

CREATE VIEW detail_view AS
SELECT
  d.id,
  d.budget_id,
  p.year,
  p.month,
  i.name AS initiative_name,
  a.name AS account_name,
  d.budget_amount,
  d.actual_amount,
  d.budget_sales_amount,
  d.actual_sales_amount,
  d.budget_profit_amount,
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
  SUM(d.budget_amount) AS budget_amount,
  SUM(d.actual_amount) AS actual_amount,
  SUM(d.budget_sales_amount) AS budget_sales_amount,
  SUM(d.actual_sales_amount) AS actual_sales_amount,
  SUM(d.budget_profit_amount) AS budget_profit_amount,
  SUM(d.actual_profit_amount) AS actual_profit_amount
FROM details AS d
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
  SUM(d.budget_sales_amount) AS budget_sales_amount,
  SUM(d.actual_sales_amount) AS actual_sales_amount,
  SUM(d.budget_profit_amount) AS budget_profit_amount,
  SUM(d.actual_profit_amount) AS actual_profit_amount
FROM details AS d
JOIN periods AS p ON p.id = d.period_id
JOIN initiatives AS i ON i.id = d.initiative_id
GROUP BY d.budget_id, d.period_id, d.initiative_id;
