export const INITIAL_EXPANSIONS = [
  { id: 1, expansionCode: "1", expansionName: "コスト" },
  { id: 2, expansionCode: "2", expansionName: "料改" },
  { id: 3, expansionCode: "3", expansionName: "撤退" },
  { id: 4, expansionCode: "4", expansionName: "物量" },
  { id: 5, expansionCode: "5", expansionName: "拡販" },
  { id: 8, expansionCode: "8", expansionName: "効率" },
  { id: 9, expansionCode: "9", expansionName: "移管" },
] as const;

export const EXPANSION_SQL = `CREATE TABLE expansions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (length(code) > 0 AND code NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
INSERT INTO expansions (id, code, name) VALUES
${INITIAL_EXPANSIONS.map(item => `(${item.id}, '${item.expansionCode}', '${item.expansionName}')`).join(",\n")};`;
