import { type Account } from "../core/accountMaster";

const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

type Month = typeof months[number];

export type InitiativeEntryDraft = {
  name: string;
  note: string;
  rows: { accountId: number | null; amounts: Partial<Record<Month, string>> }[];
};

type InitiativeEntryPageProps = {
  draft: InitiativeEntryDraft;
  onDraftChange: (draft: InitiativeEntryDraft) => void;
  accounts: Account[];
  onOpenMaster: () => void;
};

export function InitiativeEntryPage({ draft, onDraftChange, accounts, onOpenMaster }: InitiativeEntryPageProps) {
  return (
    <main className="initiative-entry-page" aria-labelledby="initiative-entry-title">
      <h1 id="initiative-entry-title">施策入力</h1>
      <div className="initiative-name-row">
        <div className="initiative-field">
          <label htmlFor="initiative-name">施策名</label>
          <input
            id="initiative-name"
            name="initiativeName"
            type="text"
            autoComplete="off"
            value={draft.name}
            onChange={event => onDraftChange({ ...draft, name: event.target.value })}
          />
        </div>
        <button className="primary-button" type="button" disabled title="登録機能は未実装です">登録</button>
      </div>
      <div className="initiative-field">
        <label htmlFor="initiative-note">備考</label>
        <input
          id="initiative-note"
          name="initiativeNote"
          type="text"
          autoComplete="off"
          value={draft.note}
          onChange={event => onDraftChange({ ...draft, note: event.target.value })}
        />
      </div>
      {accounts.length === 0 && <div className="initiative-master-guide">
        <p>勘定科目をマスタに登録すると、ここで選択できます。</p>
        <button className="secondary-button" type="button" onClick={onOpenMaster}>勘定科目マスタを開く</button>
      </div>}
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
                  <select aria-label={`${index + 1}行目の勘定科目`} value={row.accountId ?? ""} disabled={accounts.length === 0}
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
                      step="any"
                      inputMode="decimal"
                      aria-label={`${accountName} ${month}月の金額`}
                      disabled={row.accountId === null}
                      value={row.amounts[month] ?? ""}
                      onChange={event => onDraftChange({
                        ...draft,
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
        <button className="secondary-button" type="button" disabled={accounts.length === 0 || draft.rows.some(row => row.accountId === null)}
          onClick={() => onDraftChange({ ...draft, rows: [...draft.rows, { accountId: null, amounts: {} }] })}>＋ 勘定科目を追加</button>
      </div>
    </main>
  );
}
