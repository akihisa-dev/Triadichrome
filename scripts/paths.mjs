import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(scriptsRoot, "..");
export const extensionPackageRoot = path.join(projectRoot, "Triadichrome-extension");
export const buildStagingParent = path.join(projectRoot, "dist");
export const manifestTemplatePath = path.join(
  projectRoot,
  "Triadichrome-extension",
  "manifest.template.json",
);
