import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { projectRoot } from "../scripts/paths.mjs";

const versionFiles = [
  "package.json",
  "Triadichrome-extension/manifest.template.json",
  "Triadichrome-extension/manifest.json",
];

async function repository(t) {
  const root = await mkdtemp(path.join(tmpdir(), "triadichrome-workflow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith("GIT_")) delete env[name];
  Object.assign(env, { GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" });
  const run = (command, args, options = {}) => spawnSync(command, args, {
    cwd: root, env, encoding: "utf8", ...options,
  });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const script = (name, ...args) => run(process.execPath, [path.join(root, "scripts", name), ...args]);
  const setVersion = async (file, version) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), JSON.stringify({ version }) + "\n");
  };
  await mkdir(path.join(root, "scripts"));
  for (const name of ["paths.mjs", "check-samples.mjs", "check-version.mjs", "check-hooks.mjs", "setup-hooks.mjs", "version-next.mjs", "check-release.mjs"]) {
    await cp(path.join(projectRoot, "scripts", name), path.join(root, "scripts", name));
  }
  await cp(path.join(projectRoot, ".githooks"), path.join(root, ".githooks"), { recursive: true });
  for (const file of versionFiles) await setVersion(file, "1.2.0");
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Workflow Test");
  git("config", "user.email", "workflow@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("add", "--", "scripts", ".githooks", ...versionFiles);
  git("-c", `core.hooksPath=${devNull}`, "commit", "--quiet", "-m", "Initial fixture");
  return { root, run, git, script, setVersion };
}

function succeeds(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

function fails(result, message) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, message);
}

test("Gitフックの未設定を拒否し、設定後は別ディレクトリからも確認できる", async t => {
  const repo = await repository(t);
  fails(repo.script("check-hooks.mjs"), /npm run setup:hooks/);
  succeeds(repo.script("setup-hooks.mjs"));
  succeeds(repo.script("check-hooks.mjs"));
  succeeds(repo.run(process.execPath, [path.join(repo.root, "scripts/check-hooks.mjs")], { cwd: tmpdir() }));
  assert.equal(repo.git("config", "--local", "--get", "core.hooksPath"), ".githooks");
  succeeds(repo.script("setup-hooks.mjs"));
});

test("既存の別フック設定を上書きしない", async t => {
  const repo = await repository(t);
  repo.git("config", "--local", "core.hooksPath", "custom-hooks");
  fails(repo.script("setup-hooks.mjs"), /自動では上書きしません/);
  assert.equal(repo.git("config", "--local", "--get", "core.hooksPath"), "custom-hooks");
  fails(repo.script("check-hooks.mjs"), /npm run setup:hooks/);
});

test("コミットは3つのversionの登録漏れ・不一致を拒否し、揃えた変更だけ通す", async t => {
  const repo = await repository(t);
  succeeds(repo.script("setup-hooks.mjs"));
  const head = repo.git("rev-parse", "HEAD");
  for (const file of versionFiles.slice(0, 2)) await repo.setVersion(file, "1.2.1");
  repo.git("add", "--", ...versionFiles.slice(0, 2));
  fails(repo.run("git", ["commit", "-m", "Missing generated version"]), /同一commitに/);
  assert.equal(repo.git("rev-parse", "HEAD"), head);

  await repo.setVersion(versionFiles[2], "1.2.2");
  repo.git("add", "--", versionFiles[2]);
  fails(repo.run("git", ["commit", "-m", "Mismatched version"]), /versionが一致しません/);
  assert.equal(repo.git("rev-parse", "HEAD"), head);

  await repo.setVersion(versionFiles[2], "1.2.1");
  succeeds(repo.script("check-version.mjs"));
  // 作業ツリーだけ直しても、stage済みの不一致は解消した扱いにしない。
  fails(repo.script("check-version.mjs", "--staged"), /versionが一致しません/);
  repo.git("add", "--", versionFiles[2]);
  repo.git("commit", "--quiet", "-m", "Consistent version");
  assert.notEqual(repo.git("rev-parse", "HEAD"), head);
});

test("version候補は下位桁を戻して表示し、ファイルを変更しない", async t => {
  const repo = await repository(t);
  for (const [level, expected] of [["patch", "1.2.1"], ["minor", "1.3.0"], ["major", "2.0.0"]]) {
    const result = repo.script("version-next.mjs", level);
    succeeds(result);
    assert.equal(result.stdout.trim(), expected);
  }
  assert.equal(repo.git("status", "--porcelain"), "");
  fails(repo.script("version-next.mjs", "unknown"), /更新区分/);
  for (const file of versionFiles) await repo.setVersion(file, "01.2.0");
  fails(repo.script("check-version.mjs"), /MAJOR.MINOR.PATCH/);
});

test("release確認は未コミットの変更と同名tagを拒否する", async t => {
  const repo = await repository(t);
  succeeds(repo.script("check-release.mjs"));
  await writeFile(path.join(repo.root, "untracked.txt"), "pending\n");
  fails(repo.script("check-release.mjs"), /未コミットの変更/);
  await rm(path.join(repo.root, "untracked.txt"));
  repo.git("tag", "v1.2.0");
  fails(repo.script("check-release.mjs"), /tagが既に存在/);
});

test("pre-pushはブラウザ不要の検証を呼び出し、成功・失敗をpushへ返す", async t => {
  const repo = await repository(t);
  const bin = path.join(repo.root, "test-bin");
  await mkdir(bin);
  const log = path.join(repo.root, "verify-arguments.txt");
  await writeFile(path.join(bin, "npm"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$TRIADICHROME_HOOK_TEST_LOG"\nexit "$TRIADICHROME_HOOK_TEST_EXIT"\n', { mode: 0o755 });
  for (const exitCode of [0, 7]) {
    const result = repo.run("sh", [".githooks/pre-push"], {
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, TRIADICHROME_HOOK_TEST_LOG: log, TRIADICHROME_HOOK_TEST_EXIT: String(exitCode) },
    });
    assert.equal(result.status, exitCode);
    assert.equal(await readFile(log, "utf8"), "run\nverify\n");
  }
});


test("計画ファイルは大小文字とGit設定に依存せず除外し強制追加も拒否する", async t => {
  for (const ignoreCase of ["false", "true"]) for (const extension of ["triadic", "TRIADIC", "Triadic", "tRiAdIc"]) {
    const repo = await repository(t);
    repo.git("config", "core.ignorecase", ignoreCase);
    await writeFile(path.join(repo.root, ".gitignore"), await readFile(path.join(projectRoot, ".gitignore"), "utf8"));
    await mkdir(path.join(repo.root, "samples"));
    const file = `samples/check.${extension}`;
    await writeFile(path.join(repo.root, file), "local sample");
    assert.equal(repo.git("check-ignore", "--", file), file);
    fails(repo.run("git", ["add", "--", file]), /ignored/);
    succeeds(repo.script("check-samples.mjs"));
    repo.git("add", "-f", "--", file);
    fails(repo.script("check-samples.mjs"), /Git管理に含められません/);
    succeeds(repo.script("setup-hooks.mjs"));
    const head = repo.git("rev-parse", "HEAD");
    fails(repo.run("git", ["commit", "-m", "Sample must be rejected"]), /Git管理に含められません/);
    assert.equal(repo.git("rev-parse", "HEAD"), head);
    assert.equal(await readFile(path.join(repo.root, file), "utf8"), "local sample", "拒否後も元ファイルを保持する");
  }
});
