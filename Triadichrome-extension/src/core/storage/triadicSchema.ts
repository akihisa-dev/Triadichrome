import { PERIOD_MASTER_SQL } from "./periodMasterSchema";
import { DEPARTMENT_SQL } from "./departmentSchema";
import { INDUSTRY_SQL } from "./industrySchema";
import { EXPANSION_SQL } from "./expansionSchema";
import { AGGREGATION_SQL } from "./aggregationSchema";
export const TRIADIC_FILE_EXTENSION = ".triadic";
export const TRIADIC_MIME_TYPE = "application/vnd.triadichrome+sqlite";
export const TRIADIC_FORMAT_ID = "triadichrome";
export const TRIADIC_FORMAT_VERSION = 21;
const revision = "INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0)";
const amount = "INTEGER NOT NULL DEFAULT 0 CHECK (typeof(amount_yen) = 'integer' AND amount_yen BETWEEN -9007199254740991 AND 9007199254740991)";
const month = "INTEGER NOT NULL CHECK (typeof(month) = 'integer' AND month BETWEEN 1 AND 12)";
export const BUSINESS_TABLES = ["triadic_metadata", "document_info", "accounts", "expansions", "industries", "departments", "department_industries", "period_types", "aggregation_groups", "aggregation_members", "initiatives", "initiative_rows", "initiative_amounts", "previous_amounts", "kind_selections"] as const;
export const TRIADIC_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA user_version = ${TRIADIC_FORMAT_VERSION};
CREATE TABLE triadic_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
INSERT INTO triadic_metadata VALUES ('format_id', '${TRIADIC_FORMAT_ID}'), ('format_version', '${TRIADIC_FORMAT_VERSION}'), ('container', 'sqlite');
CREATE TABLE document_info (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 fiscal_year INTEGER NOT NULL CHECK (typeof(fiscal_year) = 'integer' AND fiscal_year BETWEEN 1 AND 9998),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER immutable_fiscal_year BEFORE UPDATE OF fiscal_year ON document_info BEGIN SELECT RAISE(ABORT, '年度は作成時に固定します'); END;
CREATE TABLE accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE CHECK (code GLOB '[0-9][0-9][0-9]'),
 attribute TEXT NOT NULL CHECK (attribute IN ('sales', 'cost', 'expense', 'profit')),
 name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
 display_name TEXT CHECK (display_name IS NULL OR (typeof(display_name) = 'text' AND length(trim(display_name)) > 0)),
 sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0)
);
${PERIOD_MASTER_SQL}
${DEPARTMENT_SQL}
${INDUSTRY_SQL}
CREATE TABLE department_industries (
 department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
 industry_id INTEGER NOT NULL REFERENCES industries(id),
 PRIMARY KEY (department_id, industry_id)
);
INSERT INTO department_industries SELECT departments.id, industries.id FROM departments CROSS JOIN industries;
${EXPANSION_SQL}
${AGGREGATION_SQL}
CREATE TABLE initiatives (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0), note TEXT NOT NULL DEFAULT '',
 expansion_id INTEGER NOT NULL REFERENCES expansions(id),
 industry_id INTEGER NOT NULL REFERENCES industries(id),
 department_id INTEGER NOT NULL REFERENCES departments(id),
 period_type_id INTEGER REFERENCES period_types(id),
 sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0), revision ${revision},
 FOREIGN KEY (department_id, industry_id) REFERENCES department_industries(department_id, industry_id)
);
CREATE TABLE initiative_rows (
 id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
 initiative_id INTEGER NOT NULL REFERENCES initiatives(id), account_id INTEGER NOT NULL REFERENCES accounts(id),
 sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0), revision ${revision}
);
CREATE INDEX initiative_rows_owner_idx ON initiative_rows(initiative_id, sort_order);
CREATE INDEX initiative_rows_account_idx ON initiative_rows(account_id);
CREATE TABLE initiative_amounts (
 row_id TEXT NOT NULL REFERENCES initiative_rows(id) ON DELETE CASCADE,
 kind_id INTEGER NOT NULL CHECK (typeof(kind_id) = 'integer' AND kind_id IN (1,2)),
 month ${month}, amount_yen ${amount}, revision ${revision}, PRIMARY KEY(row_id, kind_id, month)
);
CREATE TABLE previous_amounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id INTEGER NOT NULL REFERENCES accounts(id), industry_id INTEGER NOT NULL REFERENCES industries(id), department_id INTEGER NOT NULL REFERENCES departments(id),
 month ${month}, amount_yen ${amount}, revision ${revision}, UNIQUE(account_id, industry_id, department_id, month),
 FOREIGN KEY (department_id, industry_id) REFERENCES department_industries(department_id, industry_id)
);
CREATE TABLE kind_selections (
 screen TEXT PRIMARY KEY CHECK (screen IN ('initiative-list', 'cost-table', 'expansion-table')),
 first_kind INTEGER NOT NULL CHECK (first_kind IN (1,2)), second_kind INTEGER CHECK (second_kind IN (1,2)),
 CHECK (first_kind != second_kind), CHECK (screen != 'initiative-list' OR second_kind IS NULL)
);
INSERT INTO kind_selections VALUES ('initiative-list', 2, NULL), ('cost-table', 1, NULL), ('expansion-table', 1, NULL);
`;
