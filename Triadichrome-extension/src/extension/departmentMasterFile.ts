import { changeDepartmentMaster, validateDepartmentChange, type DepartmentChange } from "../core/departmentMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveDepartmentMaster(plan: OpenPlan, change: DepartmentChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateDepartmentChange(plan.departments, change);
  const handle = plan.handle ?? await chooseDestination();
  return writePlanChange(plan, handle, await changeDepartmentMaster(plan.bytes, change));
}
