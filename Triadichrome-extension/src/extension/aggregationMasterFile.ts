import { changeAggregationMaster, changedAggregations, type AggregationChange } from "../core/aggregationMaster";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveAggregationMaster(plan: OpenPlan, change: AggregationChange, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  changedAggregations(plan.aggregations, plan.accounts, change);
  const handle = plan.handle ?? await chooseDestination();
  const bytes = await changeAggregationMaster(plan.bytes, change);
  return writePlanChange(plan, handle, bytes);
}
