import { createTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";
import { installMemoryFiles, type FileScenario } from "./memory-files";

if (!import.meta.env.DEV) throw new Error("画面テストは開発サーバー専用です。");

const frame = document.querySelector<HTMLIFrameElement>("#app-preview")!;
const scenario = document.querySelector<HTMLSelectElement>("#scenario")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;
export const fixtureBytes = Array.from(await createTriadicDatabase());

frame.addEventListener("load", () => {
  const target = frame.contentWindow as Window & typeof globalThis;
  installMemoryFiles({ bytes: fixtureBytes, scenario: scenario.value as FileScenario }, target);
  // Use the real application entry point, without a test-only copy of its UI.
  status.textContent = "操作できます";
  frame.inert = false;
});

function reload() {
  status.textContent = "準備中";
  frame.inert = true;
  frame.src = "/";
}

scenario.addEventListener("change", reload);
reset.addEventListener("click", reload);
reload();
