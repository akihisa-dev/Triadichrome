import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.mjs";

const files = [
  "package.json",
  "package-lock.json",
  "Triadichrome-extension/manifest.template.json",
  "Triadichrome-extension/manifest.json",
];
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--staged")) {
  throw new Error("引数は --staged のみ指定できます。");
}
const staged = args[0] === "--staged";
const git = (...args) => execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" });

const versions = files.map(file => {
  const source = staged ? git("show", `:${file}`) : readFileSync(path.join(projectRoot, file), "utf8");
  const document = JSON.parse(source);
  const { version } = document;
  if (file === "package-lock.json" && document.packages?.[""]?.version !== version) {
    throw new Error("lockfileのroot packageのversionが一致しません。");
  }
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`${file}のversionはMAJOR.MINOR.PATCH形式で指定してください。`);
  }
  return version;
});
if (versions.some(version => version !== versions[0])) {
  throw new Error("package・lockfile・Manifestのversionが一致しません。");
}
console.log(`${staged ? "staged " : ""}version ok: ${versions[0]}`);
