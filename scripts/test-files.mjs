import { verifyInitiativeGrid } from "../tests/initiative-grid.mjs";
import { verifyPreviousGrid } from "../tests/previous-grid.mjs";
import { verifyInitiativeData } from "../tests/initiative-data.mjs";
import { verifyDetails } from "../tests/details.mjs";
import { verifyFileBoundaries } from "../tests/file-boundaries.mjs";
import { verifyDepartmentData } from "../tests/department-data.mjs";
import { verifyPeriodData } from "../tests/period-data.mjs";
import { verifyIndustryData } from "../tests/industry-data.mjs";
import { verifyExpansionData } from "../tests/expansion-data.mjs";
import { verifyHomeMasterCoverage } from "../tests/home-master-coverage.mjs";
import { verifyDefaultCostData } from "../tests/default-cost-data.mjs";
import { verifyExpansionTable } from "../tests/expansion-table.mjs";
import { verifyRecentFile } from "../tests/recent-file.mjs";
import { verifyAutoSave } from "../tests/auto-save.mjs";
import { verifyAggregationData } from "../tests/aggregation-data.mjs";
import { verifySamplePlan } from "../tests/sample-plan.mjs";
import { verifySingleYearPlan } from "../tests/single-year-plan.mjs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "dist"), { recursive: true });
const temporary = await mkdtemp(join(root, "dist", ".file-tests-"));
try {
  const bundle = join(temporary, "tests.mjs");
  await build({
    stdin: { contents: [
      'export * from "./Triadichrome-extension/src/extension/MasterPage.tsx";',
      'export * from "./Triadichrome-extension/src/extension/HomeRelationsPage.tsx";',
      'export * from "./Triadichrome-extension/src/core/triadicDatabase.ts";',
      'export * from "./Triadichrome-extension/src/core/details.ts";',
      'export * from "./Triadichrome-extension/src/core/tableView.ts";',
      'export * from "./Triadichrome-extension/src/extension/detailFile.ts";',
      'export * from "./Triadichrome-extension/src/core/accountMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/expansionMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/kindMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/kindMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/periodMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/periodMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/departmentMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/departmentMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/industryMaster.ts";',
      'export * from "./Triadichrome-extension/src/extension/industryMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/expansionMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/core/initiatives.ts";',
      'export * from "./Triadichrome-extension/src/core/expansionTable.ts";',
      'export * from "./Triadichrome-extension/src/core/autoSave.ts";',
      'export * from "./Triadichrome-extension/src/core/aggregationMaster.ts";',
      'export * from "./Triadichrome-extension/src/core/aggregationGraph.ts";',
      'export * from "./Triadichrome-extension/src/core/costTable.ts";',
      'export * from "./Triadichrome-extension/src/extension/aggregationMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/initiativeFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/accountMasterFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/triadicFile.ts";',
      'export * from "./Triadichrome-extension/src/extension/recentFile.ts";',
      'export * from "./tests/ui/sample-plan.ts";',
      'export * from "./tests/ui/empty-plan.ts";',
      'export * from "./Triadichrome-extension/src/core/amounts.ts";',
      'export * from "./Triadichrome-extension/src/core/previousGrid.ts";',
      'export * from "./Triadichrome-extension/src/core/initiativeGrid.ts";',
      'export * from "./Triadichrome-extension/src/core/kindAmounts.ts";',
      'export * from "./Triadichrome-extension/src/core/planTables.ts";',
      'export * from "./Triadichrome-extension/src/extension/planFile.ts";',
    ].join("\n"), resolveDir: root },
    loader: { ".css": "empty" },
    outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external",
    plugins: [{ name: "local-wasm", setup(api) {
      api.onResolve({ filter: /\.wasm\?url$/ }, () => ({ path: "wasm", namespace: "local-wasm" }));
      api.onLoad({ filter: /.*/, namespace: "local-wasm" }, () => ({
        contents: `export default ${JSON.stringify(join(root, "node_modules/sql.js/dist/sql-wasm-browser.wasm"))};`, loader: "js",
      }));
    } }],
  });
  const production = await import(pathToFileURL(bundle));
  const api = { ...production, createTriadicDatabase: (year = 2026) => production.createTriadicDatabase(year) };
  verifyPreviousGrid(api);
  verifyInitiativeGrid(api);
  verifyHomeMasterCoverage(api);
  await verifySingleYearPlan(api);
  await verifyDetails(api);
  await verifyInitiativeData({ ...api, createTriadicDatabase: () => api.createCurrentEmptyTestPlan(2026) }, root);
  await verifyFileBoundaries(api);
  await verifyDepartmentData(api);
  await verifyPeriodData(api);
  await verifyIndustryData(api);
  await verifyExpansionData(api);
  await verifyDefaultCostData(api);
  await verifyExpansionTable(api);
  await verifyAggregationData({ ...api, createTriadicDatabase: () => api.createCurrentEmptyTestPlan(2026) });
  await verifyAutoSave(api);
  await verifyRecentFile(api);
  await verifySamplePlan(api);
} finally { await rm(temporary, { recursive: true, force: true }); }
