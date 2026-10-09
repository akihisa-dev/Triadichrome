export * from "../Triadichrome-extension/src/core/domain/masterRows";
export * from "../Triadichrome-extension/src/core/tables/costComparison";
export * from "../Triadichrome-extension/src/core/domain/details";
export * from "../Triadichrome-extension/src/core/autoSave";
export * from "../Triadichrome-extension/src/core/domain/accountEffects";
export * from "../Triadichrome-extension/src/core/domain/accountMaster";
export * from "../Triadichrome-extension/src/core/domain/accountTypes";
export * from "../Triadichrome-extension/src/core/domain/aggregationMaster";
export * from "../Triadichrome-extension/src/core/domain/aggregations";
export * from "../Triadichrome-extension/src/core/domain/amounts";
export * from "../Triadichrome-extension/src/core/domain/calendar";
export * from "../Triadichrome-extension/src/core/domain/departmentMaster";
export * from "../Triadichrome-extension/src/core/domain/expansionMaster";
export * from "../Triadichrome-extension/src/core/domain/industryMaster";
export * from "../Triadichrome-extension/src/core/domain/initiativeRules";
export * from "../Triadichrome-extension/src/core/domain/initiativeStartMonth";
export * from "../Triadichrome-extension/src/core/domain/kinds";
export * from "../Triadichrome-extension/src/core/domain/periodMaster";
export * from "../Triadichrome-extension/src/core/domain/plan";
export * from "../Triadichrome-extension/src/core/storage/accountMaster";
export * from "../Triadichrome-extension/src/core/storage/aggregationMaster";
export * from "../Triadichrome-extension/src/core/storage/aggregationSchema";
export * from "../Triadichrome-extension/src/core/storage/aggregations";
export * from "../Triadichrome-extension/src/core/storage/dataHistory";
export * from "../Triadichrome-extension/src/core/storage/dataHistorySchema";
export * from "../Triadichrome-extension/src/core/storage/operationSnapshot";
export * from "../Triadichrome-extension/src/core/storage/defaultCostMaster";
export * from "../Triadichrome-extension/src/core/storage/departmentMaster";
export * from "../Triadichrome-extension/src/core/storage/departmentSchema";
export * from "../Triadichrome-extension/src/core/storage/details";
export * from "../Triadichrome-extension/src/core/storage/expansionMaster";
export * from "../Triadichrome-extension/src/core/storage/expansionSchema";
export * from "../Triadichrome-extension/src/core/storage/industryMaster";
export * from "../Triadichrome-extension/src/core/storage/industrySchema";
export * from "../Triadichrome-extension/src/core/storage/initiatives";
export * from "../Triadichrome-extension/src/core/storage/periodMaster";
export * from "../Triadichrome-extension/src/core/storage/periodMasterSchema";
export * from "../Triadichrome-extension/src/core/storage/readPlan";
export * from "../Triadichrome-extension/src/core/storage/settings";
export * from "../Triadichrome-extension/src/core/storage/transaction";
export * from "../Triadichrome-extension/src/core/storage/triadicDatabase";
export * from "../Triadichrome-extension/src/core/storage/triadicSchema";
export * from "../Triadichrome-extension/src/core/tables/aggregationGraph";
export * from "../Triadichrome-extension/src/core/tables/costTable";
export * from "../Triadichrome-extension/src/core/tables/details";
export * from "../Triadichrome-extension/src/core/tables/expansionTable";
export * from "../Triadichrome-extension/src/core/tables/initiativeGrid";
export * from "../Triadichrome-extension/src/core/tables/initiatives";
export * from "../Triadichrome-extension/src/core/tables/planTables";
export * from "../Triadichrome-extension/src/core/tables/previousGrid";
export * from "../Triadichrome-extension/src/core/tables/tableView";
export * from "../Triadichrome-extension/src/extension/MasterPage";
export * from "../Triadichrome-extension/src/extension/HomeRelationsPage";
export * from "../Triadichrome-extension/src/extension/PlanSession";
export * from "./ui/sample-plan";
export * from "./ui/empty-plan";
export * from "./ui/previous-export-plan";
export * from "../Triadichrome-extension/src/extension/triadicFile";
export * from "../Triadichrome-extension/src/extension/planFile";
export * from "../Triadichrome-extension/src/extension/recentFile";
export * from "../Triadichrome-extension/src/extension/planCommands";
import { writePlanCommand } from "../Triadichrome-extension/src/extension/planCommands";
import { writePlanChange, type OpenPlan } from "../Triadichrome-extension/src/extension/planFile";
import { changeDetail } from "../Triadichrome-extension/src/core/storage/details";
import type { DetailChange } from "../Triadichrome-extension/src/core/domain/details";
import type { PlanCommand } from "../Triadichrome-extension/src/extension/planCommands";
export const saveAccountMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "account" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "account", change }, destination);
export const saveAggregationMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "aggregation" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "aggregation", change }, destination);
export const saveDepartmentMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "department" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "department", change }, destination);
export const saveExpansionMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "expansion" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "expansion", change }, destination);
export const saveIndustryMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "industry" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "industry", change }, destination);
export const savePeriodMaster = (plan: OpenPlan, change: Extract<PlanCommand, { type: "period" }>["change"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "period", change }, destination);
export const saveDetailChange = async (plan: OpenPlan, change: DetailChange) => {
  if (!plan.handle) throw new Error("「保存を再試行」から保存先を選択してください。");
  return writePlanChange(plan, plan.handle, await changeDetail(plan.bytes, change));
};
export const saveInitiative = (plan: OpenPlan, draft: Extract<PlanCommand, { type: "initiative.register" }>["draft"], destination: () => Promise<FileSystemFileHandle>) => writePlanCommand(plan, { type: "initiative.register", draft }, destination);
export const saveInitiativeUpdate = (plan: OpenPlan, id: number, _year: number | null, draft: Extract<PlanCommand, { type: "initiative.update" }>["draft"]) => writePlanCommand(plan, { type: "initiative.update", id, draft }, async () => { throw new Error("保存先がありません。"); });

export * from "../Triadichrome-extension/src/core/graph/homeMotion";

export * from "../Triadichrome-extension/src/extension/tableNumberFormat";

export * from "../Triadichrome-extension/src/core/tables/periodTables";
export * from "../Triadichrome-extension/src/core/spreadsheets/workbook";

export * from "../Triadichrome-extension/src/core/tables/initiativeSort";

export * from "../Triadichrome-extension/src/core/tables/initiativeTotals";

export * from "../Triadichrome-extension/src/core/tables/tableSort";
export { processingTasks } from '../Triadichrome-extension/src/extension/planProcessingTasks';
export { visibleRows } from '../Triadichrome-extension/src/core/tables/visibleRows';

export { scheduleHistoryCheckpoint } from "../Triadichrome-extension/src/extension/usePlanSession";

export * from "../Triadichrome-extension/src/core/domain/previousAmounts";
