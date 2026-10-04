import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.mjs";

const result = spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], {
  cwd: projectRoot, encoding: "utf8",
});
if (result.status !== 0 || path.resolve(projectRoot, result.stdout.trim()) !== path.join(projectRoot, ".githooks")) {
  throw new Error("Gitフックが未設定か設定先が異なります。npm run setup:hooks を実行してください。");
}
for (const hook of ["pre-commit", "pre-push"]) {
  accessSync(path.join(projectRoot, ".githooks", hook), constants.X_OK);
}
console.log("hooks ok: .githooks");
