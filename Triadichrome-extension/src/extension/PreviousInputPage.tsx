import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useLayoutEffect, useState } from "react";
import { initiativeMonths } from "../core/domain/calendar";
import { type PlanContents } from "../core/domain/plan";
import { filterPlan } from "../core/tables/planTables";
import { PreviousAmountGrid } from "./PreviousAmountGrid";
import "./PreviousInputPage.css";
import type { PreviousInput } from "../core/domain/kinds";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ClassificationSlot } from "./ClassificationSlot";

type Props = AutoSaveProps & { contents: PlanContents; onSave: (input: PreviousInput) => Promise<void> };
export function PreviousInputPage({ contents, onSave, onPendingChange, onPrepareSave }: Props) {
  const readOnly = useHistoryReadOnly();
  const [industryId, setIndustry] = useState<number | null>(null);
  const [departmentId, setDepartment] = useState<number | null>(null);
  const autoSave = useAutoSave(onSave, onPendingChange);
  const { controller, draft } = autoSave;
  useLayoutEffect(() => {
    if (industryId === null || departmentId === null || controller.getSnapshot().draft) return;
    controller.begin({ industryId, departmentId, rows: contents.accounts.map(account => ({ accountId: account.id,
      amounts: Object.fromEntries(initiativeMonths.map(month => [month, contents.previousAmounts.find(amount => amount.accountId === account.id && amount.industryId === industryId && amount.departmentId === departmentId && amount.month === month)?.amount ?? "0"])) })) });
  }, [controller, contents, industryId, departmentId]);
  return <main className="initiative-entry-page previous-input-page" aria-labelledby="previous-input-title" onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <div className="initiative-list-heading">
      <h1 id="previous-input-title">前年入力</h1>
      <span className="field-hint">単位：千円（小数点以下3桁まで）</span>
      <div className="initiative-classification-row">
        <ClassificationSlot id="previous-industry" label="業種名" value={industryId} emptyLabel="全業種の合計"
          options={contents.industries.map(item => ({ id: item.id, name: item.industryName }))} disabled={autoSave.pending}
          onChange={value => { controller.end(); setIndustry(value); }} />
        <ClassificationSlot id="previous-department" label="部署名" value={departmentId} emptyLabel="全部署の合計"
          options={contents.departments.map(item => ({ id: item.id, name: item.departmentName }))} disabled={autoSave.pending}
          onChange={value => { controller.end(); setDepartment(value); }} />
      </div>
      <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    </div>
    <PreviousAmountGrid key={`${industryId}:${departmentId}`} contents={filterPlan(contents, {
      industries: industryId === null ? null : [industryId], departments: departmentId === null ? null : [departmentId],
    })} draft={!readOnly && industryId !== null && departmentId !== null ? draft ?? undefined : undefined} onChange={value => controller.change(value)} />
  </main>;
}
