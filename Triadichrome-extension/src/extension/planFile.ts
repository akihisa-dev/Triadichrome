import { TRIADIC_FILE_EXTENSION } from "../core/triadicDatabase";
import { readPlanContents, type PlanContents } from "../core/initiatives";
import { writeTriadicFile } from "./triadicFile";

export type OpenPlan = PlanContents & { name: string; bytes: Uint8Array; handle?: FileSystemFileHandle };

export async function writePlanChange(plan: OpenPlan, handle: FileSystemFileHandle, bytes: Uint8Array): Promise<OpenPlan> {
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
  const contents = await readPlanContents(bytes);
  if (plan.handle) {
    const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (current.length !== plan.bytes.length || current.some((value, index) => value !== plan.bytes[index])) {
      throw new Error("ファイルが別の操作で更新されています。ファイルを開き直してから登録してください。");
    }
  }
  await writeTriadicFile(handle, bytes);
  return { ...contents, bytes, name: handle.name, handle };
}
