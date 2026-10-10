import type { processingTasks } from "./planProcessingTasks";
type Tasks = typeof processingTasks;
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; original: unknown }>();
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./planProcessing.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = event => {
    const { id, value, unchanged, error } = event.data;
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error));
    else request.resolve(unchanged ? request.original : value);
  };
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error("データの処理を続けられませんでした。入力は保持しています。「保存を再試行」で処理を再開できます。"));
    pending.clear(); worker?.terminate(); worker = undefined;
  };
  return worker;
}
export async function processPlan<K extends keyof Tasks>(task: K, ...args: Parameters<Tasks[K]>): Promise<Awaited<ReturnType<Tasks[K]>>> {
  // Non-browser verification uses the identical handlers without a worker runtime.
  if (typeof Worker === "undefined") {
    const { processingTasks } = await import("./planProcessingTasks");
    const operation = processingTasks[task] as unknown as (...input: Parameters<Tasks[K]>) => ReturnType<Tasks[K]>;
    return await operation(...args) as Awaited<ReturnType<Tasks[K]>>;
  }
  const target = getWorker();
  return new Promise<Awaited<ReturnType<Tasks[K]>>>((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve: value => resolve(value as Awaited<ReturnType<Tasks[K]>>), reject, original: args[0] });
    try { target.postMessage({ id, task, args }); }
    catch (failure) { pending.delete(id); reject(failure); }
  });
}
export const createTriadicDatabase: Tasks["createTriadicDatabase"] = (...args) => processPlan("createTriadicDatabase", ...args);
export const readPlanContents: Tasks["readPlanContents"] = bytes => processPlan("readPlanContents", bytes, typeof Worker === "undefined");
export const readSnapshotContents: Tasks["readSnapshotContents"] = bytes => processPlan("readSnapshotContents", bytes, typeof Worker === "undefined");
export const applyPlanCommand: Tasks["applyPlanCommand"] = (...args) => processPlan("applyPlanCommand", ...args);
export const prepareAggregationSave: Tasks["prepareAggregationSave"] = (bytes, change) => processPlan("prepareAggregationSave", bytes, change, typeof Worker === "undefined");
export const applyOperationSnapshot: Tasks["applyOperationSnapshot"] = (...args) => processPlan("applyOperationSnapshot", ...args);
export const createBusinessSnapshot: Tasks["createBusinessSnapshot"] = (...args) => processPlan("createBusinessSnapshot", ...args);
export const readDataHistory: Tasks["readDataHistory"] = (...args) => processPlan("readDataHistory", ...args);
export const readHistorySnapshot: Tasks["readHistorySnapshot"] = (...args) => processPlan("readHistorySnapshot", ...args);
export const trackHistoryChange: Tasks["trackHistoryChange"] = (...args) => processPlan("trackHistoryChange", ...args);
export const recordDataHistory: Tasks["recordDataHistory"] = (...args) => processPlan("recordDataHistory", ...args);
export const restoreDataHistory: Tasks["restoreDataHistory"] = (...args) => processPlan("restoreDataHistory", ...args);
export const deleteDataHistory: Tasks["deleteDataHistory"] = (...args) => processPlan("deleteDataHistory", ...args);

export const prepareKindSelectionSave: Tasks["prepareKindSelectionSave"] = (...args) => processPlan("prepareKindSelectionSave", ...args);
