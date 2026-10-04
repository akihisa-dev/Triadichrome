import { useLayoutEffect } from "react";
import { type Account } from "../core/accountMaster";
import { type Initiative, type InitiativeEntryDraft } from "../core/initiatives";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";

type Props = AutoSaveProps & {
  initiative: Initiative;
  accounts: Account[];
  onUpdate: (draft: InitiativeEntryDraft) => Promise<void>;
  onBack: () => void;
  onOpenMaster: () => void;
};

export function InitiativeDetailPage({ initiative, accounts, onUpdate, onBack, onOpenMaster, onPendingChange, onPrepareSave }: Props) {
  const autoSave = useAutoSave(onUpdate, onPendingChange);
  const { controller, draft } = autoSave;
  useLayoutEffect(() => {
    if (!controller.getSnapshot().draft) controller.begin({ name: initiative.name, note: initiative.note,
      fiscalYear: initiative.fiscalYear === null ? "" : String(initiative.fiscalYear), rows: initiative.rows.length ? initiative.rows : [{ accountId: null, amounts: {} }] });
  }, [controller, initiative]);
  if (!draft) return null;
  return <InitiativeEntryPage draft={draft} onDraftChange={value => controller.change(value)} accounts={accounts}
    isSaving={false} onOpenMaster={onOpenMaster} onRegister={() => {}} editing={{
      pending: autoSave.pending, onCompositionStart: () => controller.pause(), onCompositionEnd: () => controller.resume(),
      before: <button className="text-button master-back" type="button" disabled={autoSave.pending} onClick={onBack}>← 施策一覧へ戻る</button>,
      status: <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />,
    }} />;
}
