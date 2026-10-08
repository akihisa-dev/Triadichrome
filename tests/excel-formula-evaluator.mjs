import assert from "node:assert/strict";
import JSZip from "jszip";

// Test-only interpreter for the exported Excel subset. It reads the actual XLSX
// names/tables/formulas and never reads cached formula results. This is not a
// claim of native Excel validation; packaging and Microsoft 365 need separate checks.
const unxml = s => s.replace(/&(?:amp|lt|gt|quot|apos);/g, v => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[v]);
const flat = value => Array.isArray(value) ? value.flat(Infinity) : [value];
const numeric = x => x === null || x === "" ? 0 : typeof x === "boolean" ? Number(x) : Number(x);
const equal = (a, b) => a === b || (a == null && (b === 0 || b === "")) || (b == null && (a === 0 || a === ""));
function vector(a, b, operation) {
  if (!Array.isArray(a) && !Array.isArray(b)) return operation(a, b);
  if (Array.isArray(a) && Array.isArray(b)) { assert.equal(a.length, b.length); return a.map((value, i) => vector(value, b[i], operation)); }
  return (Array.isArray(a) ? a : b).map(value => Array.isArray(a) ? vector(value, b, operation) : vector(a, value, operation));
}

function parse(expression) {
  const text = expression.replaceAll("_xlfn._xlws.", "").replaceAll("_xlfn.", "").replaceAll("_xlpm.", "");
  let offset = 0;
  const tokens = [];
  while (offset < text.length) {
    if (/\s/.test(text[offset])) { offset++; continue; }
    const rest = text.slice(offset);
    const match = rest.match(/^("(?:[^"]|"")*"|\d+(?:\.\d+)?|[A-Za-z_\u3040-\u9fff][\w.\u3040-\u9fff]*|<>|<=|>=|[()+\-*/=<>&,{};])/u);
    if (text[offset] === "[" || (match && /^[\w\u3040-\u9fff]/u.test(match[0]) && text[offset + match[0].length] === "[")) {
      const start = offset; if (text[offset] !== "[") offset += match[0].length;
      let depth = 0;
      do { const char = text[offset++]; if (char === "[") depth++; if (char === "]") depth--; } while (depth > 0 && offset < text.length);
      tokens.push(text.slice(start, offset)); continue;
    }
    assert.ok(match, `数式の字句を解釈できません: ${rest}`);
    tokens.push(match[0]); offset += match[0].length;
  }
  let position = 0;
  const next = () => tokens[position++];
  const precedence = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4 };
  const expressionAt = (minimum = 0) => {
    let left;
    const token = next();
    if (token === "-" || token === "+") left = { unary: token, value: expressionAt(5) };
    else if (token === "(") { left = expressionAt(); assert.equal(next(), ")"); }
    else if (token === "{") {
      const rows = [[]];
      do { rows.at(-1).push(expressionAt()); if (tokens[position] === ";") { next(); rows.push([]); } else if (tokens[position] === ",") next(); else break; } while (true);
      assert.equal(next(), "}"); left = { array: rows };
    } else if (token?.startsWith('"')) left = { literal: token.slice(1, -1).replaceAll('""', '"') };
    else if (/^\d/.test(token ?? "")) left = { literal: Number(token) };
    else if (tokens[position] === "(") {
      next(); const args = [];
      if (tokens[position] !== ")") do { args.push(expressionAt()); if (tokens[position] !== ",") break; next(); } while (true);
      assert.equal(next(), ")"); left = { call: token, args };
    } else left = { name: token };
    while ((precedence[tokens[position]] ?? -1) >= minimum) {
      const operator = next(); left = { operator, left, right: expressionAt(precedence[operator] + 1) };
    }
    return left;
  };
  const ast = expressionAt(); assert.equal(position, tokens.length, `数式の末尾: ${tokens.slice(position)}`); return ast;
}

export async function formulaEvaluator(wb, bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const definitions = new Map([...workbookXml.matchAll(/<definedName\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/definedName>/g)]
    .map(m => [unxml(m[1]), unxml(m[2])]));
  const tables = new Map();
  for (const sheet of wb.worksheets) {
    const rel = zip.file(`xl/worksheets/_rels/sheet${sheet.id}.xml.rels`);
    if (!rel) continue;
    const relXml = await rel.async("string");
    for (const m of relXml.matchAll(/Target="\.\.\/tables\/([^"]+)"/g)) {
      const xml = await zip.file(`xl/tables/${m[1]}`).async("string");
      const name = unxml(xml.match(/\bname="([^"]+)"/)[1]);
      const range = xml.match(/\bref="([^"]+)"/)[1];
      const columns = [...xml.matchAll(/<tableColumn\b([^>]*?)(?:\/>|>([\s\S]*?)<\/tableColumn>)/g)]
        .map(m => ({ name: unxml(m[1].match(/\bname="([^"]+)"/)[1]), formula: m[2]?.match(/<calculatedColumnFormula>(.*?)<\/calculatedColumnFormula>/)?.[1] }));
      tables.set(name, { sheet, range, columns });
    }
  }
  let cache = new Map(), visiting = new Set(), namesCache = new Map(), columnsCache = new Map();
  const asts = new Map();
  const syntax = text => { if (!asts.has(text)) asts.set(text, parse(text)); return asts.get(text); };
  function tableRange(table) {
    const first = table.sheet.getCell(table.range.split(":")[0]);
    const last = table.sheet.getCell(table.range.split(":").at(-1));
    // Tests extend the Table's range, not a preallocated body or an implementation limit.
    return { row: first.row + 1, col: first.col, end: last.row };
  }
  function reference(name, context) {
    if (name.startsWith("[@[")) {
      assert.ok(context.table); const column = name.slice(3, -2);
      const index = context.table.columns.findIndex(c => c.name === column); assert.ok(index >= 0, column);
      return cellValue(context.table.sheet, context.row, tableRange(context.table).col + index);
    }
    const match = name.match(/^([^[]+)\[(.*)\]$/);
    if (match) {
      if (columnsCache.has(name)) return columnsCache.get(name);
      const table = tables.get(match[1]); assert.ok(table, match[1]);
      const inside = match[2];
      const columns = inside.startsWith("[") ? inside.match(/^\[(.*?)\]:\[(.*?)\]$/).slice(1) : [inside, inside];
      const start = table.columns.findIndex(c => c.name === columns[0]), end = table.columns.findIndex(c => c.name === columns[1]);
      assert.ok(start >= 0 && end >= start, name);
      const range = tableRange(table);
      const values = Array.from({ length: range.end - range.row + 1 }, (_, row) => Array.from({ length: end - start + 1 }, (_, col) => cellValue(table.sheet, range.row + row, range.col + start + col)));
      columnsCache.set(name, values); return values;
    }
    if (name === "TRUE" || name === "FALSE") return name === "TRUE";
    if (name in context.env) return context.env[name];
    if (namesCache.has(name)) return namesCache.get(name);
    assert.ok(definitions.has(name), `未定義の名前 ${name}`);
    const value = evalNode(syntax(definitions.get(name)), { ...context, env: {} });
    const memo = new Map();
    const result = typeof value === "function" ? (...args) => { const key = JSON.stringify(args); if (!memo.has(key)) memo.set(key, value(...args)); return memo.get(key); } : value;
    namesCache.set(name, result); return result;
  }
  const getColumn = (array, index) => array.map(row => Array.isArray(row) ? row[index] : row);
  const cellValue = (sheet, row, col) => {
    const key = `${sheet.name}:${row}:${col}`;
    if (cache.has(key)) return cache.get(key);
    assert.ok(!visiting.has(key), `循環参照 ${key}`); visiting.add(key);
    const cell = sheet.getCell(row, col);
    const table = [...tables.values()].find(t => { const r = tableRange(t); return t.sheet === sheet && row >= r.row && row <= r.end && col >= r.col && col < r.col + t.columns.length; });
    const expression = cell.formula || (table?.columns[col - tableRange(table).col]?.formula ? unxml(table.columns[col - tableRange(table).col].formula) : undefined);
    const result = expression ? evalNode(syntax(expression), { env: {}, table, row }) : cell.value;
    visiting.delete(key); cache.set(key, result); return result;
  };
  function evalNode(node, context) {
    if ("literal" in node) return node.literal;
    if (node.name) return reference(node.name, context);
    if (node.array) return node.array.map(row => row.map(value => evalNode(value, context)));
    if (node.unary) return vector(evalNode(node.value, context), node.unary === "-" ? -1 : 1, (a, b) => numeric(a) * b);
    if (node.operator) return vector(evalNode(node.left, context), evalNode(node.right, context), (a, b) => {
      switch (node.operator) {
        case "=": return equal(a, b); case "<>": return !equal(a, b);
        case "<": return a < b; case ">": return a > b; case "<=": return a <= b; case ">=": return a >= b;
        case "&": return `${a ?? ""}${b ?? ""}`;
        case "+": return numeric(a) + numeric(b); case "-": return numeric(a) - numeric(b);
        case "*": return numeric(a) * numeric(b); case "/": return numeric(a) / numeric(b);
        default: throw new Error(node.operator);
      }
    });
    const nodes = node.args, evaluate = n => evalNode(n, context), expr = index => evaluate(nodes[index]);
    if (node.call === "IF") return flat(expr(0))[0] ? expr(1) : expr(2);
    if (node.call === "IFNA") { try { const value = expr(0); return flat(value).some(v => v?.error === "#N/A") ? expr(1) : value; } catch (e) { if (e.message !== "#N/A") throw e; return expr(1); } }
    if (node.call === "LET") {
      const env = { ...context.env }, nested = { ...context, env };
      for (let index = 0; index < nodes.length - 1; index += 2) env[nodes[index].name] = evalNode(nodes[index + 1], nested);
      return evalNode(nodes.at(-1), nested);
    }
    if (node.call === "LAMBDA") return (...values) => evalNode(nodes.at(-1), { ...context, env: { ...context.env, ...Object.fromEntries(nodes.slice(0, -1).map((n, index) => [n.name, values[index]])) } });
    const args = nodes.map(evaluate), one = index => flat(args[index])[0];
    switch (node.call) {
      case "NA": throw new Error("#N/A");
      case "SUM": return args.flat(Infinity).reduce((sum, x) => sum + (typeof x === "number" ? x : 0), 0);
      case "SUMPRODUCT": { const vectors = args.map(flat); return vectors[0].reduce((sum, _, index) => sum + vectors.reduce((n, v) => n * (typeof v[index] === "number" ? v[index] : 0), 1), 0); }
      case "COUNT": return args.flat(Infinity).filter(v => typeof v === "number").length;
      case "ROWS": return Array.isArray(args[0]) ? args[0].length : 1;
      case "COUNTIF": return flat(args[0]).filter(value => equal(value, one(1))).length;
      case "SUMIFS": { const sum = flat(args[0]); return sum.reduce((total, amount, index) => total + (args.slice(1).every((arg, n) => n % 2 ? true : equal(flat(arg)[index], flat(args[n + 2])[0])) ? numeric(amount) : 0), 0); }
      case "INDEX": {
        const array = args[0], row = numeric(one(1)), col = args.length >= 3 ? numeric(one(2)) : 1;
        if (row === 0) return getColumn(array, col - 1).map(value => [value]);
        const value = array[row - 1]; return Array.isArray(value) ? value[col - 1] : value;
      }
      case "FILTER": { const values = args[0], mask = flat(args[1]); const selected = values.filter((_, index) => Boolean(mask[index])); return selected.length ? selected : [[args[2] ?? "#CALC!"]]; }
      case "MAP": { const values = flat(args[0]), action = args.at(-1); return values.map(value => [action(value)]); }
      case "REDUCE": return flat(args[1]).reduce((value, item) => args[2](value, item), args[0]);
      case "VSTACK": return args.flatMap(arg => Array.isArray(arg) ? arg.map(row => Array.isArray(row) ? row : [row]) : [[arg]]);
      case "SEQUENCE": { const rowCount = numeric(one(0)), cols = args[1] === undefined ? 1 : numeric(one(1)), start = args[2] === undefined ? 1 : numeric(one(2)); return Array.from({ length: rowCount }, (_, row) => Array.from({ length: cols }, (_, col) => start + row * cols + col)); }
      case "SORTBY": {
        const indices = args[0].map((_, index) => index);
        indices.sort((a, b) => { for (let index = 1; index < args.length; index += 2) { const key = flat(args[index]), order = numeric(flat(args[index + 1])[0]); if (key[a] !== key[b]) return (key[a] < key[b] ? -1 : 1) * order; } return 0; });
        return indices.map(index => args[0][index]);
      }
      case "XLOOKUP": return vector(args[0], 0, (lookup) => { const index = flat(args[1]).findIndex(value => equal(value, lookup)); if (index < 0) { if (args.length > 3) return args[3]; throw new Error("#N/A"); } return flat(args[2])[index]; });
      case "XMATCH": return vector(args[0], 0, lookup => { const values = flat(args[1]), reverse = args[3] === -1; const index = reverse ? values.findLastIndex(value => equal(value, lookup)) : values.findIndex(value => equal(value, lookup)); if (index < 0) return { error: "#N/A" }; return index + 1; });
      case "ISNUMBER": return vector(args[0], 0, a => typeof a === "number");
      case "ISNA": return vector(args[0], 0, a => a?.error === "#N/A");
      case "ISERROR": return vector(args[0], 0, a => Boolean(a?.error));
      case "AND": return args.flat(Infinity).every(Boolean); case "OR": return args.flat(Infinity).some(Boolean);
      case "SEARCH": { const index = String(one(1)).indexOf(String(one(0))); return index < 0 ? { error: "#VALUE!" } : index + 1; }
      case "LEFT": return vector(args[0], 0, a => String(a).slice(0, one(1) ?? 1));
      case "MID": return String(one(0)).slice(numeric(one(1)) - 1, numeric(one(1)) - 1 + numeric(one(2)));
      case "LEN": return vector(args[0], 0, a => String(a).length);
      case "VALUE": return numeric(one(0));
      case "TEXT": return String(one(0)).padStart(String(one(1)).length, "0");
      default: { const action = reference(node.call, context); assert.equal(typeof action, "function", node.call); return action(...args); }
    }
  }
  return {
    named(name) { return reference(name, { env: {} }); },
    evaluate(sheet, address) { const cell = sheet.getCell(address); return cellValue(sheet, cell.row, cell.col); },
    reset() { cache = new Map(); visiting = new Set(); namesCache = new Map(); columnsCache = new Map(); },
    append(tableName, values) {
      const table = tables.get(tableName), range = tableRange(table), row = range.end + 1;
      values.forEach((value, index) => { table.sheet.getCell(row, range.col + index).value = value; });
      const end = table.sheet.getCell(row, range.col + table.columns.length - 1).address;
      table.range = `${table.range.split(":")[0]}:${end}`; this.reset();
    },
    tables,
  };
}
