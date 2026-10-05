export const INITIAL_KINDS = [
  { id: 1, kindName: "前年" },
  { id: 2, kindName: "一次" },
  { id: 3, kindName: "確定" },
  { id: 4, kindName: "修正" },
  { id: 5, kindName: "見通し" },
] as const;

export const KIND_MASTER_SQL = `CREATE TABLE kind_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
INSERT INTO kind_types (id, name) VALUES
${INITIAL_KINDS.map(item => `(${item.id}, '${item.kindName}')`).join(",\n")};`;
