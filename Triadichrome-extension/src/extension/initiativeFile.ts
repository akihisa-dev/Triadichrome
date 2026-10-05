import { registerInitiative, updateInitiative, validateInitiative, type InitiativeEntryDraft } from "../core/initiatives";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveInitiative(plan: OpenPlan, draft: InitiativeEntryDraft, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateInitiative(draft, plan.accounts, plan.initiatives, plan.expansions, plan.departments, plan.periodTypes);
  // Preserve transient activation for the save picker.
  const handle = plan.handle ?? await chooseDestination();
  const bytes = await registerInitiative(plan.bytes, draft);
  return writePlanChange(plan, handle, bytes);
}

export async function saveInitiativeUpdate(plan: OpenPlan, id: number, previousYear: number | null, draft: InitiativeEntryDraft): Promise<OpenPlan> {
  if (!plan.handle) throw new Error("「保存を再試行」から保存先を選択してください。");
  const bytes = await updateInitiative(plan.bytes, id, previousYear, draft);
  return writePlanChange(plan, plan.handle, bytes);
}
