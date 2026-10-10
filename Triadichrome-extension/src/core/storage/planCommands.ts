import { changeExpansionCategoryMaster } from "./expansionCategoryMaster";
import type { PlanCommand } from "../domain/planCommands";
import { changeAccountMaster } from "./accountMaster";
import { changeAggregationMaster } from "./aggregationMaster";
import { changeExpansionMaster } from "./expansionMaster";
import { changeIndustryMaster } from "./industryMaster";
import { changeDepartmentMaster } from "./departmentMaster";
import { changePeriodMaster } from "./periodMaster";
import { registerInitiative, updateInitiative } from "./initiatives";
import { changePlanSettings } from "./settings";
export async function applyPlanCommand(bytes: Uint8Array, command: PlanCommand, fiscalYear: number): Promise<Uint8Array> {
  switch (command.type) {
    case "account": return (await changeAccountMaster(bytes, command.change)).bytes;
    case "aggregation": return changeAggregationMaster(bytes, command.change);
    case "expansion-category": return changeExpansionCategoryMaster(bytes, command.change);
    case "expansion": return changeExpansionMaster(bytes, command.change);
    case "industry": return changeIndustryMaster(bytes, command.change);
    case "department": return changeDepartmentMaster(bytes, command.change);
    case "period": return changePeriodMaster(bytes, command.change);
    case "settings": return changePlanSettings(bytes, command.change);
    case "initiative.register": return registerInitiative(bytes, command.draft);
    case "initiative.update": return updateInitiative(bytes, command.id, fiscalYear, command.draft);
  }
}
