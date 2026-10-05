import { changePeriodMaster, validatePeriodTypeChange, type PeriodTypeChange } from "../core/periodMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function savePeriodMaster(plan: OpenPlan, change: PeriodTypeChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validatePeriodTypeChange(plan.periodTypes, change);
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changePeriodMaster(plan.bytes, change));
}
