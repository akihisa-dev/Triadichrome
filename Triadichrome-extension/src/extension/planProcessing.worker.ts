import { processingTasks } from "./planProcessingTasks";
// Serial requests preserve the same save ordering as PlanSession. No file handles,
// permissions or network operations enter this worker.
let tail = Promise.resolve();
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (value: unknown, transfer: Transferable[]) => void };
scope.onmessage = event => {
  const { id, task, args } = event.data as { id: number; task: keyof typeof processingTasks; args: unknown[] };
  tail = tail.then(async () => {
    try {
      const operation = processingTasks[task] as (...input: unknown[]) => Promise<unknown>;
      const value = await operation(...args);
      const unchanged = value instanceof Uint8Array && value === args[0];
      const buffers = new Set<ArrayBuffer>();
      const visit = (item: unknown) => {
        if (item instanceof Uint8Array && item.buffer instanceof ArrayBuffer) buffers.add(item.buffer);
        else if (Array.isArray(item)) item.forEach(visit);
        else if (item && typeof item === "object") Object.values(item).forEach(visit);
      };
      if (!unchanged) visit(value);
      scope.postMessage({ id, value: unchanged ? undefined : value, unchanged }, [...buffers]);
    } catch (failure) {
      scope.postMessage({ id, error: failure instanceof Error ? failure.message : "データを処理できませんでした。" }, []);
    }
  });
};
