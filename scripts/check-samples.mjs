import { execFileSync } from "node:child_process";
import { projectRoot } from "./paths.mjs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z", "--", "*.triadic"], {
  cwd: projectRoot, encoding: "utf8",
});
if (tracked.length > 0) {
  throw new Error(".triadicファイルをGit管理に含められません。ローカルに残して管理対象から外してください。");
}
console.log("samples ok: .triadicファイルはGit管理対象外");
