import { FileConflictError, recoverFileConflict } from "./fileConflict";
import { TRIADIC_FILE_EXTENSION } from "../core/storage/triadicSchema";
import { readPlanContents, processPlan } from "./planProcessing";
import { type PlanContents } from "../core/domain/plan";
import { writeTriadicFile } from "./triadicFile";
import type { DataHistoryStatus } from "../core/storage/dataHistory";
import { readDataHistory, trackHistoryChange } from "./planProcessing";
import type { prepareAggregationSave } from "../core/storage/prepareAggregationSave";

export type OpenPlan = PlanContents & { name: string; bytes: Uint8Array; handle?: FileSystemFileHandle; destinationBytes?: Uint8Array; savedHistory?: DataHistoryStatus; rebasedOperation?: { before: Uint8Array; after: Uint8Array } | null };

export async function writePlanChange(plan: OpenPlan, handle: FileSystemFileHandle, bytes: Uint8Array, options: { historyPrepared?: boolean; now?: string; allowRebase?: boolean } = {}): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  if (!options.historyPrepared) bytes = await trackHistoryChange(plan.bytes, bytes, options.now);
  const contents = await readPlanContents(bytes);
  const savedHistory = await readDataHistory(bytes);
  return writeCheckedFile(plan, { ...contents, savedHistory, bytes, name: handle.name, handle }, options.allowRebase === true);
}

/** The preparation task already validated the complete bytes and read their contents. */
export async function writePreparedPlanChange(plan: OpenPlan, handle: FileSystemFileHandle, prepared: Awaited<ReturnType<typeof prepareAggregationSave>>, allowRebase = false): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  return writeCheckedFile(plan, { ...prepared.contents, savedHistory: prepared.savedHistory, bytes: prepared.bytes, name: handle.name, handle }, allowRebase);
}

async function writeCheckedFile(plan: OpenPlan, prepared: OpenPlan & { handle: FileSystemFileHandle }, allowRebase: boolean): Promise<OpenPlan> {
  let saved = prepared;
  try {
    await writeTriadicFile(prepared.handle, prepared.bytes, async () => {
      if (!plan.handle) return;
      const current = new Uint8Array(await (await prepared.handle.getFile()).arrayBuffer());
      if (await processPlan("bytesEqual", current, plan.destinationBytes ?? plan.bytes)) return;
      if (allowRebase && !plan.destinationBytes) {
        const merged = await processPlan("rebasePlan", plan.bytes, prepared.bytes, current);
        if (merged) {
          saved = { ...await readPlanContents(merged.bytes), savedHistory: await readDataHistory(merged.bytes), bytes: merged.bytes, name: prepared.name, handle: prepared.handle, rebasedOperation: merged.operation };
          return merged.bytes;
        }
      }
      throw new FileConflictError();
    });
    return saved;
  } catch (error) {
    if (!(error instanceof FileConflictError)) throw error;
    // The old writer has been aborted before showing a dialog or opening a picker.
    const handle = await recoverFileConflict(prepared.handle);
    const expected = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    await writeTriadicFile(handle, prepared.bytes, async () => {
      const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      if (!await processPlan("bytesEqual", current, expected)) throw new FileConflictError();
    });
    return { ...prepared, name: handle.name, handle };
  }
}
