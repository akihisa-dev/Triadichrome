import type { PlanContents } from "../core/domain/plan";
import type { PreviousPatch } from "../core/domain/kinds";
/** Isolate untrusted parsing; terminate only this import on timeout or failure. */
export function processPreviousWorkbook(bytes: Uint8Array, contents: PlanContents): Promise<PreviousPatch[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./previousWorkbook.worker.ts", import.meta.url), { type: "module" });
    const finish = (patches?: PreviousPatch[], error?: string) => {
      clearTimeout(timer); worker.terminate();
      if (error) reject(new Error(error)); else resolve(patches!);
    };
    const timer = setTimeout(() => finish(undefined, "Excelの解析が30秒で完了しませんでした。入力は保持しています。フォーマットを確認して取り込み直してください。"), 30000);
    worker.onmessage = event => finish(event.data.patches, event.data.error);
    worker.onerror = () => finish(undefined, "Excelファイルの解析を続けられませんでした。入力は保持しています。ファイルを確認して取り込み直してください。");
    try { worker.postMessage({ bytes, contents }); }
    catch (error) { finish(undefined, error instanceof Error ? error.message : "Excelファイルを解析できません。"); }
  });
}
