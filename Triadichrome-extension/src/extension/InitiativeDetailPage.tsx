import { type Industry } from "../core/domain/industryMaster";
import { type PeriodType } from "../core/domain/periodMaster";
import { type Department } from "../core/domain/departmentMaster";
import { type Expansion } from "../core/domain/expansionMaster";
import { useLayoutEffect } from "react";
import { type Account } from "../core/domain/accountMaster";
import { type Initiative, type InitiativeEntryDraft } from "../core/domain/plan";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";

type Props = AutoSaveProps & {
  initiative: Initiative;
  accounts: Account[];
  expansions: Expansion[];
  departments: Department[];
  periodTypes: PeriodType[];
  industries: Industry[];
  backLabel?: string;
  onUpdate: (draft: InitiativeEntryDraft) => Promise<void>;
  onBack: () => void;
  onOpenMaster: () => void;
};

export function InitiativeDetailPage({ initiative, accounts, expansions, departments, periodTypes, industries, backLabel = "施策一覧", onUpdate, onBack, onOpenMaster, onPendingChange, onPrepareSave }: Props) {
  const autoSave = useAutoSave(onUpdate, onPendingChange);
  const { controller, draft, revision } = autoSave;
  useLayoutEffect(() => {
    if (!controller.getSnapshot().draft) controller.begin({ name: initiative.name, note: initiative.note, expansionId: initiative.expansionId, departmentId: initiative.departmentId ?? null, periodTypeId: initiative.periodTypeId ?? null, industryId: initiative.industryId ?? null,
      fiscalYear: initiative.fiscalYear === null ? "" : String(initiative.fiscalYear), rows: initiative.rows.length ? initiative.rows : [{ id: crypto.randomUUID(), accountId: null, amounts: {} }] });
  }, [controller, initiative, revision]);
  if (!draft) return null;
  return <InitiativeEntryPage draft={draft} onDraftChange={value => controller.change(value)} accounts={accounts} expansions={expansions} departments={departments} periodTypes={periodTypes} industries={industries}
    isSaving={false} onOpenMaster={onOpenMaster} onRegister={() => {}} editing={{
      savedRows: initiative.rows, saving: autoSave.saving, pending: autoSave.pending, onCompositionStart: () => controller.pause(), onCompositionEnd: () => controller.resume(),
      before: <button className="text-button master-back" type="button" disabled={autoSave.pending} onClick={onBack}>← {backLabel}へ戻る</button>,
      status: <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />,
    }} />;
}
