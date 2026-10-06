import { ClassificationSlot } from "./ClassificationSlot";
import { INITIAL_KINDS } from "../core/kindMasterSchema";
import { canChangeAccountRow, isLateMonth, resolvedAmount, type KindId } from "../core/kindAmounts";
import { useState } from "react";
import { type Industry } from "../core/industryMaster";
import { type PeriodType } from "../core/periodMaster";
import { type Department } from "../core/departmentMaster";
import { type Expansion } from "../core/expansionMaster";
import { isValidAmount } from "../core/amounts";
import { type ReactNode } from "react";
import { type Account } from "../core/accountMaster";

import { initiativeMonths as months, type InitiativeEntryDraft } from "../core/initiatives";

type InitiativeEntryPageProps = {
  draft: InitiativeEntryDraft;
  revisedActive?: boolean;
  onDraftChange: (draft: InitiativeEntryDraft) => void;
  accounts: Account[];
  expansions: Expansion[];
  departments: Department[];
  periodTypes: PeriodType[];
  industries: Industry[];
  onOpenMaster: () => void;
  isSaving: boolean;
  onRegister: () => void;
  editing?: { pending: boolean; before: ReactNode; status: ReactNode; onCompositionStart: () => void; onCompositionEnd: () => void };
};

export function InitiativeEntryPage({ draft, onDraftChange, accounts, expansions, departments, periodTypes, industries, onOpenMaster, isSaving, onRegister, editing, revisedActive = false }: InitiativeEntryPageProps) {
  const [kind, setKind] = useState<KindId>(1);
  return (
    <main className="initiative-entry-page" aria-labelledby="initiative-entry-title" aria-busy={isSaving} onCompositionStart={editing?.onCompositionStart} onCompositionEnd={editing?.onCompositionEnd}>
      {editing?.before}
      <h1 id="initiative-entry-title">{editing ? "施策詳細" : "施策入力"}</h1>
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
            disabled={isSaving}
            autoComplete="off"
            value={draft.name}
            onChange={event => onDraftChange({ ...draft, name: event.target.value })}
          />
        </div>
        {!editing && <button className="primary-button" type="button" disabled={isSaving || !draft.name.trim() || draft.expansionId === null || draft.industryId == null || draft.departmentId == null} onClick={event => {
          const inputs = event.currentTarget.closest("main")!.querySelectorAll("input");
          for (const input of inputs) if (!input.reportValidity()) return;
          onRegister();
        }}>登録</button>}
      </div>
      <div className="initiative-field">
        <label htmlFor="initiative-note">備考</label>
        <input
          id="initiative-note"
          name="initiativeNote"
          type="text"
          disabled={isSaving}
          autoComplete="off"
          value={draft.note}
          onChange={event => onDraftChange({ ...draft, note: event.target.value })}
        />
      </div>
      </div>
      <div className="initiative-classification-slots">
        <ClassificationSlot id="initiative-expansion" label="展開名" value={draft.expansionId} disabled={isSaving} required
          options={expansions.map(item => ({ id: item.id, name: item.expansionName }))}
          onChange={expansionId => onDraftChange({ ...draft, expansionId })} />
        <ClassificationSlot id="initiative-department" label="部署名" value={draft.departmentId} disabled={isSaving} required
          options={departments.map(item => ({ id: item.id, name: item.departmentName }))}
          onChange={departmentId => onDraftChange({ ...draft, departmentId })} />
        <ClassificationSlot id="initiative-period" label="期間名" value={draft.periodTypeId} disabled={isSaving}
          options={periodTypes.map(item => ({ id: item.id, name: item.periodName }))}
          onChange={periodTypeId => onDraftChange({ ...draft, periodTypeId })} />
        <ClassificationSlot id="initiative-industry" label="業種名" value={draft.industryId} disabled={isSaving} required
          options={industries.map(item => ({ id: item.id, name: item.industryName }))}
          onChange={industryId => onDraftChange({ ...draft, industryId })} />
      </div>
      </div>
      <div className="initiative-field initiative-year-field">
        <label htmlFor="initiative-year">年度</label>
        <output id="initiative-year">{draft.fiscalYear}</output>
        <span id="initiative-year-hint" className="field-hint">4月〜翌3月</span>
      </div>
      {accounts.length === 0 && <div className="initiative-master-guide">
        <p>勘定科目をマスタに登録すると、ここで選択できます。</p>
        <button className="secondary-button" type="button" disabled={isSaving || editing?.pending} onClick={onOpenMaster}>勘定科目マスタを開く</button>
      </div>}
      <div className="kind-tabs" role="tablist" aria-label="入力する種別">{INITIAL_KINDS.map(item => <button key={item.id} id={`kind-tab-${item.id}`} type="button" role="tab" aria-selected={kind === item.id} aria-controls="kind-amount-panel" onClick={() => setKind(item.id)}>{item.kindName}</button>)}</div>
      <span className="field-hint">前年差・単位：千円（小数点以下3桁まで）</span>
      <div className="initiative-amount-table-container" id="kind-amount-panel" role="tabpanel" aria-labelledby={`kind-tab-${kind}`} aria-label="月別計画金額の入力表" tabIndex={0}>
        <table className="initiative-amount-table" aria-label="月別計画金額">
          <thead>
            <tr>
              <th scope="col">勘定科目</th>
              {months.map(month => <th key={month} scope="col">{month}月</th>)}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, index) => {
              const accountName = accounts.find(account => account.id === row.accountId)?.accountName ?? `${index + 1}行目`;
              return <tr key={index}>
                <th scope="row">
                  <select aria-label={`${index + 1}行目の勘定科目`} value={row.accountId ?? ""} disabled={isSaving || accounts.length === 0 || !canChangeAccountRow(row, revisedActive)}
                    onChange={event => onDraftChange({ ...draft, rows: draft.rows.map((current, currentIndex) => currentIndex === index
                      ? { ...current, accountId: event.target.value ? Number(event.target.value) : null } : current) })}>
                    <option value="">科目を選択</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.accountCode ?? "未設定"} {account.accountName}</option>)}
                  </select>
                  <button type="button" className="text-button" aria-label={`${index + 1}行目を削除`} disabled={isSaving || !canChangeAccountRow(row, revisedActive)} onClick={() => onDraftChange({ ...draft, rows: draft.rows.filter((_, position) => position !== index) })}>削除</button>
                </th>
                {months.map(month => (
                  <td key={month}>
                    <input
                      type="number"
                      step="0.001"
                      ref={input => {
                        if (input) input.setCustomValidity(input.value === "" || isValidAmount(input.value)
                          ? "" : "金額は千円単位・小数点以下3桁までで入力してください。");
                      }}
                      inputMode="decimal"
                      aria-label={`${accountName} ${month}月の金額`}
                      disabled={isSaving || row.accountId === null || (kind === 3 && !isLateMonth(month))}
                      value={kind === 1 ? row.amounts[month] ?? "0" : row.overrides?.[kind]?.[month] ?? resolvedAmount(row, kind, month, revisedActive)}
                      onChange={event => onDraftChange({
                        ...draft,
                        invalidNumbers: [...event.currentTarget.closest("main")!.querySelectorAll("input")].some(input => input.validity.badInput),
                        rows: draft.rows.map((current, currentIndex) => currentIndex === index
                          ? kind === 1 ? { ...current, amounts: { ...current.amounts, [month]: event.target.value } } : { ...current, overrides: { ...current.overrides, [kind]: { ...current.overrides?.[kind], [month]: event.target.value } } } : current),
                      })}
                    />
                    {kind !== 1 && <div className="amount-source">{row.overrides?.[kind]?.[month] !== undefined
                      ? <button type="button" className="text-button" aria-label={`${accountName} ${month}月を引き継ぎに戻す`} disabled={isSaving} onClick={() => {
                        const overrides = { ...row.overrides, [kind]: { ...row.overrides?.[kind] } };
                        delete overrides[kind]![month];
                        onDraftChange({ ...draft, rows: draft.rows.map((current, position) => position === index ? { ...current, overrides } : current) });
                      }}>引き継ぎに戻す</button>
                      : <span>{kind === 3 && !isLateMonth(month) ? "実績から" : "引き継ぎ"}</span>}</div>}
                  </td>
                ))}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="initiative-row-actions">
        <button className="secondary-button" type="button" disabled={isSaving || accounts.length === 0 || draft.rows.some(row => row.accountId === null)}
          onClick={() => onDraftChange({ ...draft, rows: [...draft.rows, { clientKey: crypto.randomUUID(), accountId: null, amounts: {} }] })}>＋ 勘定科目を追加</button>
      </div>
    </main>
  );
}
