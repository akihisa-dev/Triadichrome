import { validateExpansionCategoryChange, type ExpansionCategoryChange } from "./expansionCategoryMaster";
import { validateAccountChange, type AccountChange } from "./accountMaster";
import { changedAggregations, type AggregationChange } from "./aggregationMaster";
import { validateExpansionChange, type ExpansionChange } from "./expansionMaster";
import { validateIndustryChange, type IndustryChange } from "./industryMaster";
import { validateDepartmentChange, type DepartmentChange } from "./departmentMaster";
import { validatePeriodTypeChange, type PeriodTypeChange } from "./periodMaster";
import { validateInitiative } from "./initiativeRules";
import type { InitiativeEntryDraft, PlanContents } from "./plan";
import type { PlanChange } from "./kinds";
export type PlanCommand =
  | { type: "account"; change: AccountChange } | { type: "aggregation"; change: AggregationChange }
  | { type: "expansion-category"; change: ExpansionCategoryChange }
  | { type: "expansion"; change: ExpansionChange } | { type: "industry"; change: IndustryChange }
  | { type: "department"; change: DepartmentChange } | { type: "period"; change: PeriodTypeChange }
  | { type: "settings"; change: PlanChange }
  | { type: "initiative.register"; draft: InitiativeEntryDraft }
  | { type: "initiative.update"; id: number; draft: InitiativeEntryDraft };
export function isAutomatic(command: PlanCommand): boolean {
  if (command.type === "initiative.update") return true;
  if (command.type === "initiative.register") return false;
  if (command.type === "settings") return command.change.type === "previous";
  return command.change.type === "update";
}
/** Validate before opening the OS picker. SQLite validates against the latest saved copy again. */
export function validatePlanCommand(plan: PlanContents, command: PlanCommand): void {
  switch (command.type) {
    case "account": return validateAccountChange(plan.accounts, command.change);
    case "aggregation": void changedAggregations(plan.aggregations, plan.accounts, command.change); return;
    case "expansion-category": return validateExpansionCategoryChange(plan.expansionCategories, command.change);
    case "expansion": return validateExpansionChange(plan.expansions, command.change);
    case "industry": return validateIndustryChange(plan.industries, command.change);
    case "department": return validateDepartmentChange(plan.departments, command.change);
    case "period": return validatePeriodTypeChange(plan.periodTypes, command.change);
    case "initiative.register": return validateInitiative(command.draft, plan.accounts, plan.initiatives, plan.expansions, plan.departments, plan.periodTypes, plan.industries);
    default: return;
  }
}
