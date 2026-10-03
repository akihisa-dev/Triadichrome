import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "dist"), { recursive: true });
const temporary = await mkdtemp(join(root, "dist", ".file-tests-"));
try {
  const bundle = join(temporary, "tests.mjs");
  await build({
    stdin: { contents: [
      'export * from "./Triadichrome-extension/src/core/triadicDatabase.ts";',
      'export * from "./Triadichrome-extension/src/extension/triadicFile.ts";',
    ].join("\n"), resolveDir: root },
    outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
    plugins: [{ name: "local-wasm", setup(api) {
      api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
      api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
        contents: `export default ${JSON.stringify(join(root, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
      }));
    } }],
  });
  const { createTriadicDatabase, validateTriadicDatabase, openTriadicDatabase, writeTriadicFile } = await import(pathToFileURL(bundle));
  const bytes = await createTriadicDatabase();
  await validateTriadicDatabase(bytes);
  await assert.rejects(validateTriadicDatabase(new Uint8Array([1, 2, 3])));
  const database = await openTriadicDatabase(bytes);
  database.run("DELETE FROM budgets");
  const invalid = database.export(); database.close();
  await assert.rejects(validateTriadicDatabase(invalid));
  let saved;
  await writeTriadicFile({ async createWritable() { return {
    async write(value) { saved = value; }, async close() {}, async abort() {},
  }; } }, bytes);
  await validateTriadicDatabase(new Uint8Array(saved));
  for (const stage of ["write", "close"]) {
    let aborted = false;
    await assert.rejects(writeTriadicFile({ async createWritable() { return {
      async write() { if (stage === "write") throw new Error("write failure"); },
      async close() { if (stage === "close") throw new Error("close failure"); },
      async abort() { aborted = true; },
    }; } }, bytes));
    assert.equal(aborted, true);
  }
  console.log("PASS: .triadic creation, validation, write and failure cleanup");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
