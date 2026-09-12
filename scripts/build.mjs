import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  buildStagingParent,
  extensionPackageRoot,
  manifestTemplatePath,
  projectRoot,
} from "./paths.mjs";

const buildOutputEnvironment = "TRIADICHROME_BUILD_OUTPUT";
const packageJsonPath = path.join(projectRoot, "package.json");
const viteEntryPath = path.join(
  projectRoot,
  "node_modules",
  "vite",
  "bin",
  "vite.js",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function runVite(stagingRoot) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [viteEntryPath, "build"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        [buildOutputEnvironment]: stagingRoot,
      },
      stdio: "inherit",
    });

    child.once("error", (error) => {
      console.error("Viteのビルドを起動できませんでした:", error.message);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });
}

async function assertFile(filePath, description) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(
      description + "が生成されていません: " + path.relative(projectRoot, filePath),
    );
  }
}

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(filePath)));
    } else {
      files.push(filePath);
    }
  }

  return files;
}

async function verifyBuild(buildRoot, manifest, checkSourceLeakage = true) {
  await assertFile(path.join(buildRoot, "index.html"), "独立ページ");
  await assertFile(path.join(buildRoot, "manifest.json"), "生成Manifest");

  const serviceWorker = manifest.background?.service_worker;
  if (typeof serviceWorker !== "string" || path.isAbsolute(serviceWorker)) {
    throw new Error("Manifestのservice worker参照が相対パスではありません。");
  }
  await assertFile(
    path.resolve(buildRoot, serviceWorker),
    "service worker",
  );

  const indexPath = path.join(buildRoot, "index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const references = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)];
  const buildPrefix = buildRoot + path.sep;

  for (const [, reference] of references) {
    if (
      !reference ||
      /^(?:[a-z][a-z\d+.-]*:|\/\/|data:|#)/i.test(reference)
    ) {
      continue;
    }

    const relativeReference = reference.split(/[?#]/, 1)[0];
    const resolvedReference = path.resolve(buildRoot, relativeReference);
    if (
      resolvedReference !== buildRoot &&
      !resolvedReference.startsWith(buildPrefix)
    ) {
      throw new Error("独立ページが出力先外を参照しています: " + reference);
    }
    await assertFile(resolvedReference, "独立ページの参照先");
  }

  if (checkSourceLeakage) {
    const files = await walkFiles(buildRoot);
    const leakedFiles = files.filter((filePath) =>
      /\.(?:ts|tsx|map)$/.test(filePath),
    );
    if (leakedFiles.length > 0) {
      throw new Error(
        "TypeScriptまたはsource mapが生成物へ漏れています: " +
          leakedFiles
            .map((filePath) => path.relative(buildRoot, filePath))
            .join(", "),
      );
    }
  }
}

async function syncBuild(stagingRoot) {
  const generatedPaths = [
    "manifest.json",
    "index.html",
    "assets",
    "src/extension/background.js",
  ];

  await fs.mkdir(extensionPackageRoot, { recursive: true });

  for (const relativePath of generatedPaths) {
    const sourcePath = path.join(stagingRoot, relativePath);
    const targetPath = path.join(extensionPackageRoot, relativePath);
    await assertFile(sourcePath, "同期対象の生成物");
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true });
  }
}

await fs.mkdir(buildStagingParent, { recursive: true });
const stagingRoot = await fs.mkdtemp(
  path.join(buildStagingParent, ".triadichrome-build-"),
);
let synced = false;

try {
  const packageJson = await readJson(packageJsonPath);
  const manifest = await readJson(manifestTemplatePath);

  if (packageJson.version !== manifest.version) {
    throw new Error(
      "package.jsonとManifest templateのversionが一致しません: " +
        packageJson.version +
        " / " +
        manifest.version,
    );
  }

  const exitCode = await runVite(stagingRoot);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    throw new Error("Viteのビルドに失敗しました。");
  }

  await fs.writeFile(
    path.join(stagingRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  await verifyBuild(stagingRoot, manifest);
  await syncBuild(stagingRoot);
  await verifyBuild(extensionPackageRoot, manifest, false);
  synced = true;

  const legacyOutputRoot = path.join(buildStagingParent, "extension");
  try {
    await fs.rm(legacyOutputRoot, { recursive: true, force: true });
  } catch (error) {
    console.warn("旧生成物の後片付けに失敗しました:", error.message);
  }
  console.log("build ok: Triadichrome-extension");
} catch (error) {
  process.exitCode = process.exitCode || 1;
  console.error("build failed:", error instanceof Error ? error.message : error);
} finally {
  await fs.rm(stagingRoot, { recursive: true, force: true });
}
