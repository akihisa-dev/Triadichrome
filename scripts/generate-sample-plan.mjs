import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { withNodeBundle } from "./node-bundle.mjs";
import { projectRoot } from "./paths.mjs";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  throw new Error("引数は --check のみ指定できます。");
}
const check = args[0] === "--check";
const relativeOutput = "samples/全機能確認用.triadic";
const output = join(projectRoot, relativeOutput);
await withNodeBundle("tests/sample-api.ts", async ({ createSamplePlan, openTriadicDatabase, SAMPLE_MAX_BYTES }, temporary) => {
  // Compare the full schema and every stored value, not SQLite's internal write counters.
  const contents = async bytes => {
    const database = await openTriadicDatabase(bytes);
    try {
      const schema = database.exec("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name")[0].values;
      const tables = schema.filter(([type]) => type === "table").map(([, name]) => {
        const rows = database.exec(`SELECT * FROM "${String(name).replaceAll('"', '""')}"`)[0];
        return [name, rows?.columns ?? [], (rows?.values ?? []).map(row => createHash("sha256").update(JSON.stringify(row.map(value => value instanceof Uint8Array ? { blob: createHash("sha256").update(value).digest("hex") } : value))).digest("hex")).sort()];
      });
      return JSON.stringify([database.exec("PRAGMA user_version"), database.exec("PRAGMA application_id"), schema, tables]);
    } finally { database.close(); }
  };
  const bytes = Buffer.from(await createSamplePlan(undefined, true));
  if (bytes.length > SAMPLE_MAX_BYTES) throw new Error(`履歴込みサンプルが50,000,000 bytesを超えています: ${bytes.length}`);
  const expected = await contents(bytes);
  const existing = await readFile(output).catch(error => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  const actual = existing ? await contents(existing).catch(() => null) : null;
  if (check && existing && existing.length > SAMPLE_MAX_BYTES) throw new Error(`実ファイルが50,000,000 bytesを超えています: ${existing.length}`);
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
});
