import { TRIADIC_FILE_EXTENSION } from "../core/storage/triadicSchema";
import { readPlanContents, processPlan } from "./planProcessing";
import { type PlanContents } from "../core/domain/plan";
import { writeTriadicFile } from "./triadicFile";
import type { DataHistoryStatus } from "../core/storage/dataHistory";
import { readDataHistory, trackHistoryChange } from "./planProcessing";
import type { prepareAggregationSave } from "../core/storage/prepareAggregationSave";

export type OpenPlan = PlanContents & { name: string; bytes: Uint8Array; handle?: FileSystemFileHandle; destinationBytes?: Uint8Array; savedHistory?: DataHistoryStatus };

export async function writePlanChange(plan: OpenPlan, handle: FileSystemFileHandle, bytes: Uint8Array, options: { historyPrepared?: boolean; now?: string } = {}): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  if (!options.historyPrepared) bytes = await trackHistoryChange(plan.bytes, bytes, options.now);
  const contents = await readPlanContents(bytes);
  const savedHistory = await readDataHistory(bytes);
  await writeCheckedFile(plan, handle, bytes);
  return { ...contents, savedHistory, bytes, name: handle.name, handle };
}

/** The preparation task already validated the complete bytes and read their contents. */
export async function writePreparedPlanChange(plan: OpenPlan, handle: FileSystemFileHandle, prepared: Awaited<ReturnType<typeof prepareAggregationSave>>): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  await writeCheckedFile(plan, handle, prepared.bytes);
  return { ...prepared.contents, savedHistory: prepared.savedHistory, bytes: prepared.bytes, name: handle.name, handle };
}

async function writeCheckedFile(plan: OpenPlan, handle: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  await writeTriadicFile(handle, bytes, async () => {
    if (plan.handle) {
      const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      const expected = plan.destinationBytes ?? plan.bytes;
      if (!await processPlan("bytesEqual", current, expected)) {
        throw new Error("ファイルが別の操作で更新されています。入力内容を控え、ファイルを開き直してから更新してください。");
      }
    }
  });
}
