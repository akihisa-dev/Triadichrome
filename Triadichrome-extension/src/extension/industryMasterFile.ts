import { changeIndustryMaster, validateIndustryChange, type IndustryChange } from "../core/industryMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveIndustryMaster(plan: OpenPlan, change: IndustryChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateIndustryChange(plan.industries, change);
  if (change.type === "delete" && plan.initiatives.some(item => item.industryId === change.id)) throw new Error("施策で使用している業種は削除できません。");
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changeIndustryMaster(plan.bytes, change));
}
