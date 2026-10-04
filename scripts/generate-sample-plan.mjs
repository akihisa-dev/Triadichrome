import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { projectRoot } from "./paths.mjs";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  throw new Error("引数は --check のみ指定できます。");
}
const check = args[0] === "--check";
const relativeOutput = "samples/全機能確認用.triadic";
const output = join(projectRoot, relativeOutput);
const dist = join(projectRoot, "dist");
await mkdir(dist, { recursive: true });
const temporary = await mkdtemp(join(dist, ".sample-plan-"));
try {
  const bundle = join(temporary, "sample-plan.mjs");
  await build({
    stdin: {
      contents: 'export { createSamplePlan } from "./tests/ui/sample-plan.ts";\nexport { openTriadicDatabase } from "./Triadichrome-extension/src/core/triadicDatabase.ts";',
      resolveDir: projectRoot,
    },
    outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
    plugins: [{ name: "local-wasm", setup(api) {
      api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
      api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
        contents: `export default ${JSON.stringify(join(projectRoot, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
      }));
    } }],
  });
  const { createSamplePlan, openTriadicDatabase } = await import(pathToFileURL(bundle));
  // Compare the full schema and every stored value, not SQLite's internal write counters.
  const contents = async bytes => {
    const database = await openTriadicDatabase(bytes);
    try {
      const schema = database.exec("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name")[0].values;
      const tables = schema.filter(([type]) => type === "table").map(([, name]) => {
        const rows = database.exec(`SELECT * FROM "${String(name).replaceAll('"', '""')}"`)[0];
        return [name, rows?.columns ?? [], (rows?.values ?? []).map(row => JSON.stringify(row)).sort()];
      });
      return JSON.stringify([database.exec("PRAGMA user_version"), database.exec("PRAGMA application_id"), schema, tables]);
    } finally { database.close(); }
  };
  const bytes = Buffer.from(await createSamplePlan());
  const expected = await contents(bytes);
  const existing = await readFile(output).catch(error => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  const actual = existing ? await contents(existing).catch(() => null) : null;
  if (actual === expected) {
    console.log(`sample ok: ${relativeOutput}`);
  } else if (check) {
    throw new Error(`${relativeOutput}が未生成または古い内容です。npm run samples:generate を実行してください。`);
  } else {
    await mkdir(dirname(output), { recursive: true });
    const pending = join(temporary, "sample.triadic");
    await writeFile(pending, bytes);
    await rename(pending, output);
    console.log(`sample generated: ${relativeOutput}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
