import { type Department } from "../core/departmentMaster";
import { type Expansion } from "../core/expansionMaster";
import { isValidAmount } from "../core/amounts";
import { type ReactNode } from "react";
import { type Account } from "../core/accountMaster";

import { initiativeMonths as months, type InitiativeEntryDraft } from "../core/initiatives";

type InitiativeEntryPageProps = {
  draft: InitiativeEntryDraft;
  onDraftChange: (draft: InitiativeEntryDraft) => void;
  accounts: Account[];
  expansions: Expansion[];
  departments: Department[];
  onOpenMaster: () => void;
  isSaving: boolean;
  onRegister: () => void;
  editing?: { pending: boolean; before: ReactNode; status: ReactNode; onCompositionStart: () => void; onCompositionEnd: () => void };
};

export function InitiativeEntryPage({ draft, onDraftChange, accounts, expansions, departments, onOpenMaster, isSaving, onRegister, editing }: InitiativeEntryPageProps) {
  return (
    <main className="initiative-entry-page" aria-labelledby="initiative-entry-title" aria-busy={isSaving} onCompositionStart={editing?.onCompositionStart} onCompositionEnd={editing?.onCompositionEnd}>
      {editing?.before}
      <h1 id="initiative-entry-title">{editing ? "施策詳細" : "施策入力"}</h1>
      {editing?.status}
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
        {!editing && <button className="primary-button" type="button" disabled={isSaving || !draft.name.trim() || draft.expansionId === null} onClick={event => {
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
      <div className="initiative-classification-row">
      <div className="initiative-field initiative-year-field">
        <label htmlFor="initiative-year">年度</label>
        <input id="initiative-year" type="number" min="1" max="9998" step="1" value={draft.fiscalYear} disabled={isSaving}
          aria-describedby="initiative-year-hint" onChange={event => onDraftChange({ ...draft, fiscalYear: event.target.value,
            invalidNumbers: [...event.currentTarget.closest("main")!.querySelectorAll("input")].some(input => input.validity.badInput) })} />
        <span id="initiative-year-hint" className="field-hint">4月〜翌3月</span>
      </div>
      <div className="initiative-field initiative-expansion-field">
        <label htmlFor="initiative-expansion">展開名</label>
        <select id="initiative-expansion" value={draft.expansionId ?? ""} disabled={isSaving} required
          onChange={event => onDraftChange({ ...draft, expansionId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">展開名を選択</option>
          {expansions.map(item => <option key={item.id} value={item.id}>{item.expansionName}</option>)}
        </select>
      </div>
      <div className="initiative-field initiative-expansion-field">
        <label htmlFor="initiative-department">部署名</label>
        <select id="initiative-department" value={draft.departmentId ?? ""} disabled={isSaving}
          onChange={event => onDraftChange({ ...draft, departmentId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">部署名を選択</option>
          {departments.map(item => <option key={item.id} value={item.id}>{item.departmentName}</option>)}
        </select>
      </div>
      </div>
      {accounts.length === 0 && <div className="initiative-master-guide">
        <p>勘定科目をマスタに登録すると、ここで選択できます。</p>
        <button className="secondary-button" type="button" disabled={isSaving || editing?.pending} onClick={onOpenMaster}>勘定科目マスタを開く</button>
      </div>}
      <span className="field-hint">単位：千円（小数点以下3桁まで）</span>
      <div className="initiative-amount-table-container" role="region" aria-label="月別計画金額の入力表" tabIndex={0}>
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
                  <select aria-label={`${index + 1}行目の勘定科目`} value={row.accountId ?? ""} disabled={isSaving || accounts.length === 0}
                    onChange={event => onDraftChange({ ...draft, rows: draft.rows.map((current, currentIndex) => currentIndex === index
                      ? { ...current, accountId: event.target.value ? Number(event.target.value) : null } : current) })}>
                    <option value="">科目を選択</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.accountCode ?? "未設定"} {account.accountName}</option>)}
                  </select>
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
                      disabled={isSaving || row.accountId === null}
                      value={row.amounts[month] ?? ""}
                      onChange={event => onDraftChange({
                        ...draft,
                        invalidNumbers: [...event.currentTarget.closest("main")!.querySelectorAll("input")].some(input => input.validity.badInput),
                        rows: draft.rows.map((current, currentIndex) => currentIndex === index
                          ? { ...current, amounts: { ...current.amounts, [month]: event.target.value } } : current),
                      })}
                    />
                  </td>
                ))}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="initiative-row-actions">
        <button className="secondary-button" type="button" disabled={isSaving || accounts.length === 0 || draft.rows.some(row => row.accountId === null)}
          onClick={() => onDraftChange({ ...draft, rows: [...draft.rows, { accountId: null, amounts: {} }] })}>＋ 勘定科目を追加</button>
      </div>
    </main>
  );
}
