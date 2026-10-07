import { execFileSync } from "node:child_process";
import { projectRoot } from "./paths.mjs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], {
  cwd: projectRoot, encoding: "utf8",
});
const sample = "samples/全機能確認用.triadic";
if (tracked.split("\0").some(file => /\.triadic$/i.test(file) && file !== sample)) {
  throw new Error("確認用サンプル以外の.triadicファイルをGit管理に含められません。ローカルに残して管理対象から外してください。");
}
console.log("samples ok: 確認用サンプル以外の.triadicファイルはGit管理対象外");
