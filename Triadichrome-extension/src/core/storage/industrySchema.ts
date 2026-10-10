export const INITIAL_INDUSTRIES = [
  { id: 1, industryCode: "1", industryName: "直営自動車" },
  { id: 2, industryCode: "2", industryName: "自動車取扱" },
  { id: 3, industryCode: "3", industryName: "不動産A" },
  { id: 4, industryCode: "4", industryName: "不動産B" },
  { id: 5, industryCode: "5", industryName: "納品代行" },
  { id: 6, industryCode: "6", industryName: "雑作業" },
  { id: 7, industryCode: "7", industryName: "業務費B" },
  { id: 8, industryCode: "8", industryName: "一般管理費" },
  { id: 9, industryCode: "9", industryName: "営業外" },
] as const;

export const INDUSTRY_SQL = `CREATE TABLE industries (
  id INTEGER PRIMARY KEY,
  identity TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))) CHECK (typeof(identity) = 'text' AND length(identity) = 32 AND identity NOT GLOB '*[^0-9a-f]*'),
  code TEXT NOT NULL UNIQUE CHECK (length(code) > 0 AND code NOT GLOB '*[^0-9]*'),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);
INSERT INTO industries (id, code, name) VALUES
${INITIAL_INDUSTRIES.map(item => `(${item.id}, '${item.industryCode}', '${item.industryName}')`).join(",\n")};`;
