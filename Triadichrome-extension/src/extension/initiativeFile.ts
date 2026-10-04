import { registerInitiative, validateInitiative, type InitiativeEntryDraft } from "../core/initiatives";
import { writePlanChange, type OpenPlan } from "./planFile";

export async function saveInitiative(plan: OpenPlan, draft: InitiativeEntryDraft, chooseDestination: () => Promise<FileSystemFileHandle>): Promise<OpenPlan> {
  validateInitiative(draft, plan.accounts, plan.initiatives);
  // Preserve transient activation for the save picker.
  const handle = plan.handle ?? await chooseDestination();
  const bytes = await registerInitiative(plan.bytes, draft);
  return writePlanChange(plan, handle, bytes);
}
