import { createTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";
import { readPlanContents } from "../../Triadichrome-extension/src/core/storage/readPlan";
import { registerInitiative } from "../../Triadichrome-extension/src/core/storage/initiatives";
import { saveKindSelection, savePreviousAmounts } from "../../Triadichrome-extension/src/core/storage/settings";
import { createInitiativeDraft } from "../../Triadichrome-extension/src/core/domain/initiativeRules";

export type OverflowScenario = "monthly" | "period" | "previous" | "difference" | "normal" | "initiative" | "previous-input";

/** Real, accepted SQLite data; only file I/O is replaced by memory-files. */
export async function createOverflowPlan(scenario: OverflowScenario) {
  let bytes = await createTriadicDatabase(2026);
  const plan = await readPlanContents(bytes);
  const accountId = plan.accounts.find(account => account.accountType === "sales")!.id;
  const huge = "5000000000000";
  if (scenario === "previous-input") {
    for (const departmentId of [1, 2]) bytes = await savePreviousAmounts(bytes, { industryId: 1, departmentId,
      rows: [{ accountId, amounts: { 4: huge } }] });
    return bytes;
  }
  const draft = { ...createInitiativeDraft("2026"), name: "上限確認A", expansionId: 1, industryId: 1, departmentId: 1,
    rows: [{ accountId, amounts: { 4: scenario === "normal" ? "10" : scenario === "difference" ? `-${huge}` : huge,
      ...(scenario === "period" ? { 5: huge } : {}) },
      ...(scenario === "difference" ? { overrides: { 2: { 4: huge } } } : {}) }] };
  if (scenario === "initiative") draft.rows = [1, 2].map(() => ({ accountId, amounts: { 4: "0" }, overrides: { 2: { 4: huge } } }));
  bytes = await registerInitiative(bytes, draft);
  if (scenario === "initiative") bytes = await registerInitiative(bytes, { ...draft, name: "通常確認", rows: [{ accountId, amounts: { 4: "1" }, overrides: { 2: { 4: "2" } } }] });
  if (scenario === "monthly") bytes = await registerInitiative(bytes, { ...draft, name: "上限確認B", industryId: 2 });
  if (scenario === "previous") bytes = await savePreviousAmounts(bytes, { industryId: 1, departmentId: 1, rows: [{ accountId, amounts: { 4: huge } }] });
  if (scenario === "difference") {
    bytes = await saveKindSelection(bytes, "cost-table", [1, 2]);
    bytes = await saveKindSelection(bytes, "expansion-table", [1, 2]);
  }
  return bytes;
}
