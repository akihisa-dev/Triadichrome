import { useLayoutEffect, useState } from "react";
import { initiativeMonths, type PlanContents } from "../core/initiatives";
import { filterPlan } from "../core/planTables";
import { PreviousAmountGrid } from "./PreviousAmountGrid";
import "./PreviousInputPage.css";
import type { PreviousInput } from "../core/kindAmounts";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";

type Props = AutoSaveProps & { contents: PlanContents; onSave: (input: PreviousInput) => Promise<void> };
export function PreviousInputPage({ contents, onSave, onPendingChange, onPrepareSave }: Props) {
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
    <h1 id="previous-input-title">前年入力</h1>
    <div className="initiative-classification-row">
      <div className="initiative-field"><label>年度</label><output>{contents.fiscalYear}年度の前年</output></div>
      <div className="initiative-field"><label htmlFor="previous-industry">業種名</label><select id="previous-industry" disabled={autoSave.pending} value={industryId ?? ""} onChange={event => { controller.end(); setIndustry(event.target.value ? Number(event.target.value) : null); }}>
        <option value="">全業種の合計</option>{contents.industries.map(item => <option key={item.id} value={item.id}>{item.industryName}</option>)}
      </select></div>
      <div className="initiative-field"><label htmlFor="previous-department">部署名</label><select id="previous-department" disabled={autoSave.pending} value={departmentId ?? ""} onChange={event => { controller.end(); setDepartment(event.target.value ? Number(event.target.value) : null); }}>
        <option value="">全部署の合計</option>{contents.departments.map(item => <option key={item.id} value={item.id}>{item.departmentName}</option>)}
      </select></div>
    </div>
    <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    <span className="field-hint">単位：千円（小数点以下3桁まで）</span>
    <PreviousAmountGrid key={`${industryId}:${departmentId}`} contents={filterPlan(contents, {
      industries: industryId === null ? null : [industryId], departments: departmentId === null ? null : [departmentId],
    })} draft={industryId !== null && departmentId !== null ? draft ?? undefined : undefined} onChange={value => controller.change(value)} />
  </main>;
}
