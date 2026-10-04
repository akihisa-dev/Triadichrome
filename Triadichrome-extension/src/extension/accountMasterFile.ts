import { changeAccountMaster, validateAccountChange, type AccountChange } from "../core/accountMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveAccountMaster(
  plan: OpenPlan,
  change: AccountChange,
  chooseDestination: () => Promise<FileSystemFileHandle>,
): Promise<OpenPlan> {
  validateAccountChange(plan.accounts, change);
  // Invoke the picker while the user's click still grants file access.
  const handle = plan.handle ?? await chooseDestination();
  const result = await changeAccountMaster(plan.bytes, change);
  return writePlanChange(plan, handle, result.bytes);
}
