export const INITIAL_DEPARTMENTS = [
  { id: 1, departmentName: "部署A" },
  { id: 2, departmentName: "部署B" },
] as const;

export const DEPARTMENT_SQL = `CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  identity TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (typeof(identity) = 'text' AND length(identity) = 32 AND identity NOT GLOB '*[^0-9a-f]*'),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
INSERT INTO departments (id, name) VALUES
${INITIAL_DEPARTMENTS.map(item => `(${item.id}, '${item.departmentName}')`).join(",\n")};`;
