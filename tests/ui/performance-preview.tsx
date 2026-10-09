import { Profiler, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSamplePlan } from "./sample-plan";
import { readPlanContents } from "../../Triadichrome-extension/src/core/storage/readPlan";
import { PreviousAmountGrid } from "../../Triadichrome-extension/src/extension/PreviousAmountGrid";
import { InitiativeAmountGrid } from "../../Triadichrome-extension/src/extension/InitiativeAmountGrid";
import { ExpansionTablePage } from "../../Triadichrome-extension/src/extension/ExpansionTablePage";
import { initiativeMonths } from "../../Triadichrome-extension/src/core/domain/calendar";
import type { PreviousInput } from "../../Triadichrome-extension/src/core/domain/kinds";
import type { InitiativeEntryDraft } from "../../Triadichrome-extension/src/core/domain/plan";
import "../../Triadichrome-extension/src/extension/ExtensionPage.css";
const params = new URLSearchParams(location.search), count = Number(params.get("count") ?? 100), mode = params.get("mode") ?? "previous";
const base = await readPlanContents(await createSamplePlan(2026));
const accounts = Array.from({length: count}, (_, i) => ({...base.accounts[0]!, id: i + 1, accountCode: String(i+1).padStart(3, "0"), accountName: params.has("sameNames") && i < 2 ? "同名科目" : `科目${i}`}));
const contents = {...base, accounts, previousAmounts: [], initiatives: Array.from({length: count}, (_, i) => ({...base.initiatives[0]!, id: i + 1, name: `施策${i}`, expansionId: base.expansions[0]!.id}))};
const measurements: { phase: string; actualMs: number; baseMs: number }[] = [];
Object.assign(window, { gridMeasurements: measurements });
function Preview() {
 const [previous, setPrevious] = useState<PreviousInput>({industryId: 1, departmentId: 1, rows: accounts.map(a => ({accountId: a.id, amounts: Object.fromEntries(initiativeMonths.map(m=>[m,"0"]))}))});
 const [draft, setDraft] = useState<InitiativeEntryDraft>({...base.initiatives[0]!, fiscalYear: "2026", rows: Array.from({length: Math.min(count,200)}, (_, i)=>({id:String(i+1),accountId:accounts[i]!.id, amounts: Object.fromEntries(initiativeMonths.map(m=>[m,"0"]))}))});
 // Optional regression guard: a monthly cell must never linearly search all input rows.
 if (params.has("guard")) Object.defineProperty(previous.rows, "find", { configurable: true, value: () => { throw new Error("入力行の繰り返し検索"); } });
 return <Profiler id="grid" onRender={(_,phase,actualMs,baseMs)=>measurements.push({phase,actualMs,baseMs})}>
  {mode === "previous" ? <PreviousAmountGrid contents={contents} draft={previous} onChange={setPrevious}/> : mode === "initiative" ? <InitiativeAmountGrid draft={draft} kind={1} accounts={accounts} isSaving={false} onDraftChange={setDraft}/> : <ExpansionTablePage contents={contents} selected={[1,2]} selection={null} onOpenInitiative={()=>{}} />}
 </Profiler>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
