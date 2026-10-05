import { changeExpansionMaster, validateExpansionChange, type ExpansionChange } from "../core/expansionMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveExpansionMaster(plan: OpenPlan, change: ExpansionChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateExpansionChange(plan.expansions, change);
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changeExpansionMaster(plan.bytes, change));
}
