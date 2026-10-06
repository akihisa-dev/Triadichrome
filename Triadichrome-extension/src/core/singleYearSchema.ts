/** Primary amounts remain complete; the other kinds store only manual overrides. */
export const SINGLE_YEAR_SQL = `
ALTER TABLE budgets ADD COLUMN fiscal_year INTEGER NOT NULL DEFAULT 2026
  CHECK (typeof(fiscal_year) = 'integer' AND fiscal_year BETWEEN 1 AND 9998);
ALTER TABLE budgets ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0);
ALTER TABLE initiative_rows ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX initiative_rows_client_key ON initiative_rows(client_key) WHERE client_key IS NOT NULL;
CREATE TABLE amount_overrides (
  row_id INTEGER NOT NULL REFERENCES initiative_rows(id) ON DELETE CASCADE,
  kind_id INTEGER NOT NULL REFERENCES kind_types(id) ON DELETE RESTRICT CHECK (kind_id = 2),
  month INTEGER NOT NULL CHECK (typeof(month) = 'integer' AND month BETWEEN 1 AND 12),
  amount_yen INTEGER NOT NULL CHECK (typeof(amount_yen) = 'integer' AND amount_yen BETWEEN -9007199254740991 AND 9007199254740991),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  PRIMARY KEY (row_id, kind_id, month)
);
CREATE TABLE previous_amounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  month INTEGER NOT NULL CHECK (typeof(month) = 'integer' AND month BETWEEN 1 AND 12),
  amount_yen INTEGER NOT NULL CHECK (typeof(amount_yen) = 'integer' AND amount_yen BETWEEN -9007199254740991 AND 9007199254740991),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  UNIQUE (account_id, industry_id, department_id, month)
);
CREATE TABLE kind_selections (
  screen TEXT PRIMARY KEY CHECK (screen IN ('initiative-list', 'cost-table', 'expansion-table')),
  first_kind INTEGER NOT NULL REFERENCES kind_types(id),
  second_kind INTEGER REFERENCES kind_types(id),
  CHECK (first_kind != second_kind),
  CHECK (screen != 'initiative-list' OR second_kind IS NULL)
);
INSERT INTO kind_selections VALUES ('initiative-list', 2, NULL), ('cost-table', 1, NULL), ('expansion-table', 1, NULL);
CREATE TRIGGER fixed_kind_insert BEFORE INSERT ON kind_types BEGIN SELECT RAISE(ABORT, '種別は固定です'); END;
CREATE TRIGGER fixed_kind_update BEFORE UPDATE ON kind_types BEGIN SELECT RAISE(ABORT, '種別は固定です'); END;
CREATE TRIGGER fixed_kind_delete BEFORE DELETE ON kind_types BEGIN SELECT RAISE(ABORT, '種別は固定です'); END;
CREATE TRIGGER immutable_fiscal_year BEFORE UPDATE OF fiscal_year ON budgets BEGIN SELECT RAISE(ABORT, '年度は作成時に固定します'); END;
CREATE TRIGGER initiative_classification_insert BEFORE INSERT ON initiatives
WHEN NEW.fiscal_year != (SELECT fiscal_year FROM budgets WHERE id = 1)
  OR NEW.expansion_id IS NULL OR NEW.industry_id IS NULL OR NEW.department_id IS NULL
BEGIN SELECT RAISE(ABORT, '年度・展開・業種・部署が不正です'); END;
CREATE TRIGGER initiative_classification_update BEFORE UPDATE ON initiatives
WHEN NEW.fiscal_year != (SELECT fiscal_year FROM budgets WHERE id = 1)
  OR NEW.expansion_id IS NULL OR NEW.industry_id IS NULL OR NEW.department_id IS NULL
BEGIN SELECT RAISE(ABORT, '年度・展開・業種・部署が不正です'); END;
PRAGMA user_version = 14;
UPDATE triadic_metadata SET value = '14' WHERE key = 'format_version';
`;
