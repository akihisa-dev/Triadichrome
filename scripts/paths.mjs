import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(scriptsRoot, "..");
export const extensionSourceRoot = path.join(
  projectRoot,
  "Triadichrome-extension",
  "src",
);
export const extensionPackageRoot = path.join(projectRoot, "Triadichrome-extension");
export const buildStagingParent = path.join(projectRoot, "dist");
export const manifestTemplatePath = path.join(
  projectRoot,
  "Triadichrome-extension",
  "manifest.template.json",
);

export function extensionSourcePath(relativePath) {
  return path.join(extensionSourceRoot, relativePath);
}

export function extensionPackagePath(relativePath) {
  return path.join(extensionPackageRoot, relativePath);
}

export function generatedJavaScriptPath(sourceFile) {
  const relativeSource = path.relative(extensionSourceRoot, sourceFile);
  return path.join(
    extensionPackageRoot,
    "src",
    relativeSource.replace(/\.ts$/, ".js"),
  );
}
