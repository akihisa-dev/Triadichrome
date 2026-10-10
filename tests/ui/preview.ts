import { saveKindSelection } from "../../Triadichrome-extension/src/core/storage/settings";
import { createOverflowPlan, type OverflowScenario } from "./overflow-plan";
import { createEmptyTestPlan, createCurrentEmptyTestPlan } from "./empty-plan";
import { createTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";
import { installMemoryFiles, type FileScenario } from "./memory-files";
import { createSamplePlan } from "./sample-plan";
import { createPreviousExportPlan } from "./previous-export-plan";

if (!import.meta.env.DEV) throw new Error("画面テストは開発サーバー専用です。");

const frame = document.querySelector<HTMLIFrameElement>("#app-preview")!;
const scenario = document.querySelector<HTMLSelectElement>("#scenario")!;
const dataset = document.querySelector<HTMLSelectElement>("#dataset")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;
const emptyBytes = Array.from(await createCurrentEmptyTestPlan());
const legacyBytes = Array.from(await createEmptyTestPlan());
const defaultBytes = Array.from(await createTriadicDatabase());
const sampleBytes = Array.from(await createSamplePlan());
let largeSampleBytes: Uint8Array | undefined;
const requested = new URLSearchParams(location.search).get("data");
dataset.value = [...dataset.options].some(option => option.value === requested) ? requested! : "full";
export let fixtureBytes: number[] | Uint8Array = dataset.value === "legacy" ? legacyBytes : dataset.value === "empty" ? emptyBytes : dataset.value === "defaults" ? defaultBytes : sampleBytes;

frame.addEventListener("load", async () => {
  const target = frame.contentWindow as Window & typeof globalThis;
  const externalBytes = scenario.value === "file-conflict" ? await saveKindSelection(new Uint8Array(fixtureBytes), "cost-table", [2]) : undefined;
  installMemoryFiles({ bytes: fixtureBytes, scenario: scenario.value as FileScenario, ...(externalBytes ? { externalBytes } : {}) }, target);
  // Use the real application entry point, without a test-only copy of its UI.
  status.textContent = "操作できます";
  frame.inert = false;
});

let reloadVersion = 0;
async function reload() {
  const version = ++reloadVersion;
  const value = dataset.value;
  status.textContent = "準備中";
  frame.inert = true;
  const bytes = value === "large" ? (largeSampleBytes ??= new Uint8Array(await (await fetch("/samples/全機能確認用.triadic")).arrayBuffer())) : value === "previous-export-limit" ? await createPreviousExportPlan() : value.startsWith("overflow-") ? Array.from(await createOverflowPlan(value.slice(9) as OverflowScenario)) :
    value === "legacy" ? legacyBytes : value === "empty" ? emptyBytes : value === "defaults" ? defaultBytes : sampleBytes;
  if (version !== reloadVersion) return;
  fixtureBytes = bytes;
  frame.src = "/";
}

scenario.addEventListener("change", reload);
dataset.addEventListener("change", reload);
reset.addEventListener("click", reload);
reload();
