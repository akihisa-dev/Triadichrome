export const NORMALIZED_TABLES_SQL = `
CREATE TABLE initiatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL DEFAULT 1 CHECK (budget_id = 1) REFERENCES budgets(id),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  note TEXT NOT NULL DEFAULT '',
  fiscal_year INTEGER NOT NULL CHECK (typeof(fiscal_year) = 'integer' AND fiscal_year BETWEEN 1 AND 9998),
  expansion_id INTEGER REFERENCES expansions(id) ON DELETE RESTRICT,
  department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
  period_type_id INTEGER REFERENCES period_types(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  UNIQUE (budget_id, name)
);
CREATE TABLE initiative_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE RESTRICT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0)
);
CREATE TABLE initiative_amounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  row_id INTEGER NOT NULL REFERENCES initiative_rows(id) ON DELETE RESTRICT,
  month INTEGER NOT NULL CHECK (typeof(month) = 'integer' AND month BETWEEN 1 AND 12),
  amount_yen INTEGER NOT NULL DEFAULT 0 CHECK (typeof(amount_yen) = 'integer' AND amount_yen BETWEEN -9007199254740991 AND 9007199254740991),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  UNIQUE (row_id, month)
);
CREATE INDEX initiatives_year_idx ON initiatives(fiscal_year, sort_order, id);
CREATE INDEX initiative_rows_owner_idx ON initiative_rows(initiative_id, sort_order, id);
CREATE INDEX initiative_rows_account_idx ON initiative_rows(account_id);
CREATE INDEX initiatives_expansion_idx ON initiatives(expansion_id);
CREATE INDEX initiatives_department_idx ON initiatives(department_id);
CREATE INDEX initiatives_period_type_idx ON initiatives(period_type_id);
`;

export function normalizedViews(legacyViews: string): string { return `
CREATE VIEW details AS
SELECT m.id, 1 AS budget_id,
  (SELECT p.id FROM periods p WHERE p.year = i.fiscal_year + (m.month < 4) AND p.month = m.month) AS period_id,
  i.id AS initiative_id, r.account_id, r.id AS entry_row_id,
  m.amount_yen / 1000.0 AS budget_amount,
  0 AS actual_amount,
  0 AS budget_sales_amount, 0 AS actual_sales_amount,
  0 AS budget_profit_amount, 0 AS actual_profit_amount,
  NULL AS note
FROM initiative_amounts m JOIN initiative_rows r ON r.id = m.row_id
JOIN initiatives i ON i.id = r.initiative_id;
${legacyViews}
CREATE VIEW initiative_detail_view AS
SELECT m.id AS detail_id, r.id AS row_id, i.id AS initiative_id,
  i.name AS initiative_name, i.note AS initiative_note, i.fiscal_year,
  i.fiscal_year + (m.month < 4) AS calendar_year, m.month,
  (m.month + 8) % 12 AS fiscal_month_position,
  i.expansion_id, i.department_id, i.period_type_id,
  r.account_id, a.code AS account_code, a.name AS account_name, a.attribute AS account_attribute,
  m.amount_yen,
  CASE a.attribute WHEN 'sales' THEN m.amount_yen WHEN 'cost' THEN -m.amount_yen
    WHEN 'expense' THEN 0 WHEN 'profit' THEN 0 END AS sales_effect_yen,
  CASE a.attribute WHEN 'sales' THEN m.amount_yen WHEN 'cost' THEN -m.amount_yen
    WHEN 'expense' THEN -m.amount_yen WHEN 'profit' THEN m.amount_yen END AS profit_effect_yen,
  i.sort_order AS initiative_order, r.sort_order AS row_order,
  i.revision AS initiative_revision, r.revision AS row_revision, m.revision AS detail_revision
FROM initiative_amounts m JOIN initiative_rows r ON r.id = m.row_id
JOIN initiatives i ON i.id = r.initiative_id JOIN accounts a ON a.id = r.account_id;
` }
