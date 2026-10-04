import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, realpathSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.mjs";

const options = { cwd: projectRoot, encoding: "utf8" };
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], options).trim();
if (realpathSync(gitRoot) !== realpathSync(projectRoot)) {
  throw new Error("TriadichromeのGitルートで実行してください。");
}
const current = spawnSync("git", ["config", "--get", "core.hooksPath"], options);
if (current.status !== 0 && current.status !== 1) throw new Error("Gitフック設定を確認できませんでした。");
if (current.status === 0 && path.resolve(projectRoot, current.stdout.trim()) !== path.join(projectRoot, ".githooks")) {
  throw new Error("既存の別フック設定があります。自動では上書きしません。設定を確認してください。");
}
for (const hook of ["pre-commit", "pre-push"]) {
  chmodSync(path.join(projectRoot, ".githooks", hook), 0o755);
}
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], options);
console.log("このリポジトリのGitフックを有効にしました。");
