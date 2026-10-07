import { validateAccountChange, type AccountChange } from "../core/domain/accountMaster";
import { changedAggregations, type AggregationChange } from "../core/domain/aggregationMaster";
import { validateExpansionChange, type ExpansionChange } from "../core/domain/expansionMaster";
import { validateIndustryChange, type IndustryChange } from "../core/domain/industryMaster";
import { validateDepartmentChange, type DepartmentChange } from "../core/domain/departmentMaster";
import { validatePeriodTypeChange, type PeriodTypeChange } from "../core/domain/periodMaster";
import { validateInitiative } from "../core/domain/initiativeRules";
import type { InitiativeEntryDraft } from "../core/domain/plan";
import type { PlanChange } from "../core/domain/kinds";
import type { DetailChange } from "../core/domain/details";
import { changeAccountMaster } from "../core/storage/accountMaster";
import { changeAggregationMaster } from "../core/storage/aggregationMaster";
import { changeExpansionMaster } from "../core/storage/expansionMaster";
import { changeIndustryMaster } from "../core/storage/industryMaster";
import { changeDepartmentMaster } from "../core/storage/departmentMaster";
import { changePeriodMaster } from "../core/storage/periodMaster";
import { registerInitiative, updateInitiative } from "../core/storage/initiatives";
import { changePlanSettings } from "../core/storage/settings";
import { changeDetail } from "../core/storage/details";
import { writePlanChange, type OpenPlan } from "./planFile";
export type PlanCommand =
  | { type: "account"; change: AccountChange } | { type: "aggregation"; change: AggregationChange }
  | { type: "expansion"; change: ExpansionChange } | { type: "industry"; change: IndustryChange }
  | { type: "department"; change: DepartmentChange } | { type: "period"; change: PeriodTypeChange }
  | { type: "settings"; change: PlanChange } | { type: "detail"; change: DetailChange }
  | { type: "initiative.register"; draft: InitiativeEntryDraft }
  | { type: "initiative.update"; id: number; draft: InitiativeEntryDraft };
export function isAutomatic(command: PlanCommand): boolean {
  if (command.type === "initiative.update" || command.type === "detail") return true;
  if (command.type === "initiative.register") return false;
  if (command.type === "settings") return command.change.type === "previous";
  return command.change.type === "update";
}
/** Validate before opening the OS picker. SQLite validates against the latest saved copy again. */
export function validatePlanCommand(plan: OpenPlan, command: PlanCommand): void {
  switch (command.type) {
    case "account": return validateAccountChange(plan.accounts, command.change);
    case "aggregation": void changedAggregations(plan.aggregations, plan.accounts, command.change); return;
    case "expansion": return validateExpansionChange(plan.expansions, command.change);
    case "industry": return validateIndustryChange(plan.industries, command.change);
    case "department": return validateDepartmentChange(plan.departments, command.change);
    case "period": return validatePeriodTypeChange(plan.periodTypes, command.change);
    case "initiative.register": return validateInitiative(command.draft, plan.accounts, plan.initiatives, plan.expansions, plan.departments, plan.periodTypes, plan.industries);
    default: return;
  }
}
export async function applyPlanCommand(bytes: Uint8Array, command: PlanCommand, fiscalYear: number): Promise<Uint8Array> {
  switch (command.type) {
    case "account": return (await changeAccountMaster(bytes, command.change)).bytes;
    case "aggregation": return changeAggregationMaster(bytes, command.change);
    case "expansion": return changeExpansionMaster(bytes, command.change);
    case "industry": return changeIndustryMaster(bytes, command.change);
    case "department": return changeDepartmentMaster(bytes, command.change);
    case "period": return changePeriodMaster(bytes, command.change);
    case "settings": return changePlanSettings(bytes, command.change);
    case "detail": return changeDetail(bytes, command.change);
    case "initiative.register": return registerInitiative(bytes, command.draft);
    case "initiative.update": return updateInitiative(bytes, command.id, fiscalYear, command.draft);
  }
}
export async function writePlanCommand(plan: OpenPlan, command: PlanCommand, destination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validatePlanCommand(plan, command);
  if (isAutomatic(command) && !plan.handle) throw new Error("「保存を再試行」から保存先を選択してください。");
  const handle = plan.handle ?? await destination();
  const bytes = await applyPlanCommand(plan.bytes, command, plan.fiscalYear);
  return writePlanChange(plan, handle, bytes);
}
