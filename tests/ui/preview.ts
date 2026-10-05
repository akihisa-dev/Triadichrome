import { createEmptyTestPlan } from "./empty-plan";
import { createTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";
import { installMemoryFiles, type FileScenario } from "./memory-files";
import { createSamplePlan } from "./sample-plan";

if (!import.meta.env.DEV) throw new Error("画面テストは開発サーバー専用です。");

const frame = document.querySelector<HTMLIFrameElement>("#app-preview")!;
const scenario = document.querySelector<HTMLSelectElement>("#scenario")!;
const dataset = document.querySelector<HTMLSelectElement>("#dataset")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;
const emptyBytes = Array.from(await createEmptyTestPlan());
const defaultBytes = Array.from(await createTriadicDatabase());
const sampleBytes = Array.from(await createSamplePlan());
const requested = new URLSearchParams(location.search).get("data");
dataset.value = requested === "empty" || requested === "defaults" ? requested : "full";
export let fixtureBytes = dataset.value === "empty" ? emptyBytes : dataset.value === "defaults" ? defaultBytes : sampleBytes;

frame.addEventListener("load", () => {
  const target = frame.contentWindow as Window & typeof globalThis;
  installMemoryFiles({ bytes: fixtureBytes, scenario: scenario.value as FileScenario }, target);
  // Use the real application entry point, without a test-only copy of its UI.
  status.textContent = "操作できます";
  frame.inert = false;
});

function reload() {
  fixtureBytes = dataset.value === "empty" ? emptyBytes : dataset.value === "defaults" ? defaultBytes : sampleBytes;
  status.textContent = "準備中";
  frame.inert = true;
  frame.src = "/";
}

scenario.addEventListener("change", reload);
dataset.addEventListener("change", reload);
reset.addEventListener("click", reload);
reload();
