import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.mjs";
import "./check-version.mjs";

const git = (...args) => execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("release対象に未コミットの変更があります。");
const { version } = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const tag = `v${version}`;
if (git("tag", "--list", tag)) throw new Error("同じversionのローカルtagが既に存在します。");
console.log(`release ok: ${tag}（ローカル確認）`);
