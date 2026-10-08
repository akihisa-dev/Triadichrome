import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.mjs";

const args = process.argv.slice(2);
const levels = ["major", "minor", "patch"];
if (args.length === 0 || args.some(level => !levels.includes(level))) {
  throw new Error("更新区分をcommit順に指定してください: major、minor、patch");
}
const { version } = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error("現在のversionがMAJOR.MINOR.PATCH形式ではありません。");
}
const parts = version.split(".").map(BigInt);
for (const level of args) {
  const index = levels.indexOf(level);
  parts[index] += 1n;
  parts.fill(0n, index + 1);
}
console.log(parts.join("."));
