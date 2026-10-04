import { changeAccountMaster, validateAccountChange, type Account, type AccountChange } from "../core/accountMaster";
import { TRIADIC_FILE_EXTENSION } from "../core/triadicDatabase";
import { writeTriadicFile } from "./triadicFile";

export type OpenPlan = {
  name: string;
  bytes: Uint8Array;
  accounts: Account[];
  handle?: FileSystemFileHandle;
};

export async function saveAccountMaster(
  plan: OpenPlan,
  change: AccountChange,
  chooseDestination: () => Promise<FileSystemFileHandle>,
): Promise<OpenPlan> {
  validateAccountChange(plan.accounts, change);
  // Invoke the picker while the user's click still grants file access.
  const handle = plan.handle ?? await chooseDestination();
  if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) {
    throw new Error("拡張子は.triadicにしてください。");
  }
  if (plan.handle) {
    const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (current.length !== plan.bytes.length || current.some((value, index) => value !== plan.bytes[index])) {
      throw new Error("ファイルが別の操作で更新されています。ファイルを開き直してから登録してください。");
    }
  }
  const result = await changeAccountMaster(plan.bytes, change);
  await writeTriadicFile(handle, result.bytes);
  return { ...result, name: handle.name, handle };
}
