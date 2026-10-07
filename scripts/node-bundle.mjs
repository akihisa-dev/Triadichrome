import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { projectRoot } from "./paths.mjs";
/** Private temporary bundle; resources are cleaned after the complete operation. */
export async function withNodeBundle(entry, operation) {
  const dist = join(projectRoot, "dist");
  await mkdir(dist, { recursive: true });
  const temporary = await mkdtemp(join(dist, ".node-bundle-"));
  try {
    const bundle = join(temporary, "entry.mjs");
    await build({ entryPoints: [join(projectRoot, entry)], loader: { ".css": "empty" },
      outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
      plugins: [{ name: "local-wasm", setup(api) {
        api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
        api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
          contents: `export default ${JSON.stringify(join(projectRoot, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
        }));
      } }],
    });
    return await operation(await import(pathToFileURL(bundle)), temporary);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
