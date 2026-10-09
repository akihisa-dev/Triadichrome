import { reflectPrimaryBudget } from "../core/tables/initiativeGrid";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { InitiativeAmountGrid } from "./InitiativeAmountGrid";
import { ClassificationSlot } from "./ClassificationSlot";
import { INITIAL_KINDS } from "../core/domain/kinds";
import { type KindId } from "../core/domain/kinds";
import { useState } from "react";
import { type Industry } from "../core/domain/industryMaster";
import { type PeriodType } from "../core/domain/periodMaster";
import { type Department } from "../core/domain/departmentMaster";
import { type Expansion } from "../core/domain/expansionMaster";
import { type ReactNode } from "react";
import { type Account } from "../core/domain/accountMaster";

import { type InitiativeEntryDraft } from "../core/domain/plan";

type InitiativeEntryPageProps = {
  draft: InitiativeEntryDraft;
  onDraftChange: (draft: InitiativeEntryDraft) => void;
  accounts: Account[];
  expansions: Expansion[];
  departments: Department[];
  periodTypes: PeriodType[];
  industries: Industry[];
  onOpenMaster: () => void;
  isSaving: boolean;
  onRegister: () => void;
  onBack?: () => void;
  editing?: { savedRows: InitiativeEntryDraft["rows"]; saving: boolean; pending: boolean; before: ReactNode; status: ReactNode; onCompositionStart: () => void; onCompositionEnd: () => void };
};

export function InitiativeEntryPage({ draft, onDraftChange, accounts, expansions, departments, periodTypes, industries, onOpenMaster, isSaving, onRegister, onBack, editing }: InitiativeEntryPageProps) {
  const readOnly = useHistoryReadOnly();
  const [kind, setKind] = useState<KindId>(1);
  return (
    <main className={editing ? "initiative-entry-page" : "initiative-entry-page initiative-entry-compact"} aria-labelledby="initiative-entry-title" aria-busy={isSaving} onCompositionStart={editing?.onCompositionStart} onCompositionEnd={editing?.onCompositionEnd}>
      {editing?.before}
      {!editing && onBack && <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← 施策一覧へ戻る</button>}
      <h1 id="initiative-entry-title">施策入力</h1>
      {editing?.status}
      <div className="initiative-header-fields">
      <div className="initiative-text-fields">
      <div className="initiative-name-row">
        <div className="initiative-field">
          <label htmlFor="initiative-name">施策名</label>
          <input
            id="initiative-name"
            name="initiativeName"
            type="text"
            disabled={readOnly || isSaving}
            autoComplete="off"
            value={draft.name}
            onChange={event => onDraftChange({ ...draft, name: event.target.value })}
          />
        </div>
      <div className="initiative-field">
        <label htmlFor="initiative-note">備考</label>
        <input
          id="initiative-note"
          name="initiativeNote"
          type="text"
          disabled={readOnly || isSaving}
          autoComplete="off"
          value={draft.note}
          onChange={event => onDraftChange({ ...draft, note: event.target.value })}
        />
      </div>
        {!editing && <button className="primary-button" type="button" disabled={readOnly || isSaving || !draft.name.trim() || draft.expansionId === null || draft.industryId == null || draft.departmentId == null} onClick={event => {
          const inputs = event.currentTarget.closest("main")!.querySelectorAll("input");
          for (const input of inputs) if (!input.reportValidity()) return;
          onRegister();
        }}>登録</button>}
      </div>
      </div>
      <div className="initiative-classification-slots">
        <ClassificationSlot id="initiative-expansion" label="展開名" value={draft.expansionId} disabled={readOnly || isSaving} required
          options={expansions.map(item => ({ id: item.id, name: item.expansionName }))}
          onChange={expansionId => onDraftChange({ ...draft, expansionId })} />
        <ClassificationSlot id="initiative-department" label="部署名" value={draft.departmentId} disabled={readOnly || isSaving} required
          options={departments.map(item => ({ id: item.id, name: item.departmentName }))}
          onChange={departmentId => onDraftChange({ ...draft, departmentId })} />
        <ClassificationSlot id="initiative-period" label="期間名" value={draft.periodTypeId} disabled={readOnly || isSaving}
          options={periodTypes.map(item => ({ id: item.id, name: item.periodName }))}
          onChange={periodTypeId => onDraftChange({ ...draft, periodTypeId })} />
        <ClassificationSlot id="initiative-industry" label="業種名" value={draft.industryId} disabled={readOnly || isSaving} required
          options={industries.map(item => ({ id: item.id, name: item.industryName }))}
          onChange={industryId => onDraftChange({ ...draft, industryId })} />
      </div>
      </div>
      {accounts.length === 0 && <div className="initiative-master-guide">
        <p>勘定科目がありません。</p>
        <button className="secondary-button" type="button" disabled={isSaving || editing?.pending} onClick={onOpenMaster}>勘定科目マスタを開く</button>
      </div>}
      <div className="kind-tabs" role="tablist" aria-label="入力する種別">{INITIAL_KINDS.map(item => <button key={item.id} id={`kind-tab-${item.id}`} type="button" role="tab" aria-selected={kind === item.id} aria-controls="kind-amount-panel" onClick={() => setKind(item.id)}>{item.kindName}</button>)}</div>
      {kind === 2 && <div className="initiative-budget-actions">
        <button className="secondary-button" type="button" disabled={readOnly || isSaving || !draft.rows.some(row => Object.keys(row.overrides?.[2] ?? {}).length > 0)}
          onClick={() => onDraftChange(reflectPrimaryBudget(draft))}>一次予算を反映する</button>
      </div>}
      <div className="initiative-amount-table-container" id="kind-amount-panel" role="tabpanel" aria-labelledby={`kind-tab-${kind}`} aria-label="月別計画金額の入力表" tabIndex={0}>
        <InitiativeAmountGrid key={kind} draft={draft} kind={kind}
          accounts={accounts} savedRows={editing?.savedRows} rowOperationsDisabled={editing?.saving ?? false} isSaving={readOnly || isSaving} onDraftChange={onDraftChange} />
      </div>
      <div className="initiative-row-actions">
        <button className="secondary-button" type="button" disabled={readOnly || isSaving || accounts.length === 0 || draft.rows.some(row => row.accountId === null)}
          onClick={() => onDraftChange({ ...draft, rows: [...draft.rows, { id: crypto.randomUUID(), accountId: null, amounts: {} }] })}>＋ 勘定科目を追加</button>
      </div>
    </main>
  );
}
