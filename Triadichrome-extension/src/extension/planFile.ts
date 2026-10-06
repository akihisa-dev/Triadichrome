import { TRIADIC_FILE_EXTENSION } from "../core/triadicDatabase";
import { readPlanContents, type PlanContents } from "../core/initiatives";
import { writeTriadicFile } from "./triadicFile";
import { trackHistoryChange } from "../core/dataHistory";

export type OpenPlan = PlanContents & { name: string; bytes: Uint8Array; handle?: FileSystemFileHandle; destinationBytes?: Uint8Array };

export async function writePlanChange(plan: OpenPlan, handle: FileSystemFileHandle, bytes: Uint8Array, options: { historyPrepared?: boolean; now?: string } = {}): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  if ((plan.formatVersion ?? 10) < 10 && plan.handle && !plan.destinationBytes
    && (handle === plan.handle || (handle.isSameEntry && await handle.isSameEntry(plan.handle)))) {
    throw new Error("旧形式の元ファイルを残すため、別名の保存先を選択してください。");
  }
  if (!options.historyPrepared) bytes = await trackHistoryChange(plan.bytes, bytes, options.now);
  const contents = await readPlanContents(bytes);
  if (plan.handle) {
    const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    const expected = plan.destinationBytes ?? plan.bytes;
    if (current.length !== expected.length || current.some((value, index) => value !== expected[index])) {
      throw new Error("ファイルが別の操作で更新されています。入力内容を控え、ファイルを開き直してから更新してください。");
    }
  }
  await writeTriadicFile(handle, bytes);
  return { ...contents, bytes, name: handle.name, handle };
}
