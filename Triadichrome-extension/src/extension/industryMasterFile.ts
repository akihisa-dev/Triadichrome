import { changeIndustryMaster, validateIndustryChange, type IndustryChange } from "../core/industryMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveIndustryMaster(plan: OpenPlan, change: IndustryChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateIndustryChange(plan.industries, change);
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changeIndustryMaster(plan.bytes, change));
}
