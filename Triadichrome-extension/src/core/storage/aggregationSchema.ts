export const AGGREGATION_SQL = `
CREATE TABLE aggregation_groups (
  id INTEGER PRIMARY KEY,
  display_name TEXT CHECK (display_name IS NULL OR length(trim(display_name)) > 0),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  required_key TEXT UNIQUE CHECK (required_key IN ('sales', 'expenses', 'operating', 'ordinary'))
);
CREATE TABLE aggregation_members (
  parent_id INTEGER NOT NULL REFERENCES aggregation_groups(id),
  account_id INTEGER UNIQUE REFERENCES accounts(id),
  group_id INTEGER UNIQUE REFERENCES aggregation_groups(id),
  sign INTEGER NOT NULL CHECK (sign IN (1, -1)),
  position INTEGER NOT NULL CHECK (typeof(position) = 'integer' AND position BETWEEN 0 AND 9007199254740991),
  CHECK ((account_id IS NULL) != (group_id IS NULL)),
  CHECK (parent_id != group_id)
);
INSERT INTO aggregation_groups (id, name, required_key) VALUES
  (1, '売上集計', 'sales'), (2, '費用集計', 'expenses'),
  (3, '営業利益', 'operating'), (4, '経常利益', 'ordinary');
`;
