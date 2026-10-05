import { changeDetail, type DetailChange } from "../core/details";
import { writePlanChange, type OpenPlan } from "./planFile";
export async function saveDetailChange(plan: OpenPlan, change: DetailChange): Promise<OpenPlan> {
  if (!plan.handle) throw new Error("「保存を再試行」から保存先を選択してください。");
  return writePlanChange(plan, plan.handle, await changeDetail(plan.bytes, change));
}
