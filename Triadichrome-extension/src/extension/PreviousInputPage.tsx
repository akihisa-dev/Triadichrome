import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useLayoutEffect, useMemo, useState } from "react";
import { createPreviousInput } from "../core/domain/previousAmounts";
import { type PlanContents } from "../core/domain/plan";
import { filterPlan } from "../core/tables/planTables";
import { PreviousAmountGrid } from "./PreviousAmountGrid";
import "./PreviousInputPage.css";
import "./KindSelectionSlots.css";
import type { PreviousInput } from "../core/domain/kinds";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ChoiceChips } from "./ChoiceChips";

type Props = AutoSaveProps & { contents: PlanContents; onSave: (input: PreviousInput) => Promise<void> };
export function PreviousInputPage({ contents, onSave, onPendingChange, onPrepareSave }: Props) {
  const readOnly = useHistoryReadOnly();
  const [industryIds, setIndustries] = useState<number[]>([]);
  const [departmentIds, setDepartments] = useState<number[]>([]);
  const industryId = industryIds.length === 1 ? industryIds[0]! : null;
  const departmentId = departmentIds.length === 1 ? departmentIds[0]! : null;
  const autoSave = useAutoSave(onSave, onPendingChange);
  const { controller, draft, revision } = autoSave;
  useLayoutEffect(() => {
    if (industryIds.some(id => !contents.industries.some(item => item.id === id))) { controller.end(); setIndustries(ids => ids.filter(id => contents.industries.some(item => item.id === id))); return; }
    if (departmentIds.some(id => !contents.departments.some(item => item.id === id))) { controller.end(); setDepartments(ids => ids.filter(id => contents.departments.some(item => item.id === id))); return; }
    if (industryId === null || departmentId === null || controller.getSnapshot().draft) return;
    controller.begin(createPreviousInput(contents, industryId, departmentId));
  }, [controller, contents, industryIds, departmentIds, industryId, departmentId, revision]);
  const filtered = useMemo(() => filterPlan(contents, {
    industries: industryIds.length ? industryIds : null, departments: departmentIds.length ? departmentIds : null,
  }), [contents, industryIds, departmentIds]);
  return <main className="initiative-entry-page previous-input-page" aria-labelledby="previous-input-title" onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <div className="initiative-list-heading">
      <h1 id="previous-input-title">前年入力</h1>
      <div className="initiative-classification-row">
        <ChoiceChips id="previous-industry" label="業種名" value={industryIds} emptyLabel="全業種の合計"
          options={contents.industries.map(item => ({ id: item.id, name: item.industryName }))} disabled={autoSave.pending}
          onChange={value => { controller.end(); setIndustries(value); }} />
        <ChoiceChips id="previous-department" label="部署名" value={departmentIds} emptyLabel="全部署の合計"
          options={contents.departments.map(item => ({ id: item.id, name: item.departmentName }))} disabled={autoSave.pending}
          onChange={value => { controller.end(); setDepartments(value); }} />
      </div>
      <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    </div>
    <PreviousAmountGrid key={`${industryIds.join(",")}:${departmentIds.join(",")}`} contents={filtered} draft={!readOnly && industryId !== null && departmentId !== null ? draft ?? undefined : undefined} onChange={value => controller.change(value)} />
  </main>;
}
