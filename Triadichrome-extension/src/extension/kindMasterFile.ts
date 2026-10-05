import { changeKindMaster, validateKindChange, type KindChange } from "../core/kindMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveKindMaster(plan: OpenPlan, change: KindChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateKindChange(plan.kinds, change);
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changeKindMaster(plan.bytes, change));
}
