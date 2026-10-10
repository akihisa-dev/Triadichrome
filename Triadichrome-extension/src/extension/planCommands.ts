import { isAutomatic, validatePlanCommand, type PlanCommand } from "../core/domain/planCommands";
import { applyPlanCommand } from "../core/storage/planCommands";
import { writePlanChange, type OpenPlan } from "./planFile";
export { isAutomatic, validatePlanCommand, type PlanCommand } from "../core/domain/planCommands";
export { applyPlanCommand } from "../core/storage/planCommands";

export async function writePlanCommand(plan: OpenPlan, command: PlanCommand, destination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validatePlanCommand(plan, command);
  if (isAutomatic(command) && !plan.handle) throw new Error("「保存を再試行」から保存先を選択してください。");
  const handle = plan.handle ?? await destination();
  const bytes = await applyPlanCommand(plan.bytes, command, plan.fiscalYear);
  return writePlanChange(plan, handle, bytes);
}
