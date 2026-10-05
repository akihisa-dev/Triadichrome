export const INITIAL_DEPARTMENTS = [
  { id: 1, departmentName: "部署A" },
  { id: 2, departmentName: "部署B" },
] as const;

export const DEPARTMENT_SQL = `CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
INSERT INTO departments (id, name) VALUES
${INITIAL_DEPARTMENTS.map(item => `(${item.id}, '${item.departmentName}')`).join(",\n")};`;
