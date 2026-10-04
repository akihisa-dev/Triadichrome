const months = [4, 5, 6, 7, 8, 9] as const;
const accounts = [
  { id: "sales", name: "売上高" },
  { id: "supplies", name: "消耗品費" },
  { id: "salaries", name: "給与手当" },
] as const;

type Month = typeof months[number];
type AccountId = typeof accounts[number]["id"];

export type InitiativeEntryDraft = {
  name: string;
  note: string;
  amounts: Partial<Record<AccountId, Partial<Record<Month, string>>>>;
};

type InitiativeEntryPageProps = {
  draft: InitiativeEntryDraft;
  onDraftChange: (draft: InitiativeEntryDraft) => void;
};

export function InitiativeEntryPage({ draft, onDraftChange }: InitiativeEntryPageProps) {
  return (
    <main className="initiative-entry-page" aria-labelledby="initiative-entry-title">
      <h1 id="initiative-entry-title">施策入力</h1>
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
      <div className="initiative-field">
        <label htmlFor="initiative-note">備考</label>
        <textarea
          id="initiative-note"
          name="initiativeNote"
          rows={3}
          value={draft.note}
          onChange={event => onDraftChange({ ...draft, note: event.target.value })}
        />
      </div>
      <div className="initiative-amount-table-container" role="region" aria-label="月別計画金額の入力表" tabIndex={0}>
        <table className="initiative-amount-table" aria-label="月別計画金額">
          <thead>
            <tr>
              <th scope="col">勘定科目</th>
              {months.map(month => <th key={month} scope="col">{month}月</th>)}
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => (
              <tr key={account.id}>
                <th scope="row">{account.name}</th>
                {months.map(month => (
                  <td key={month}>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label={`${account.name} ${month}月の金額`}
                      value={draft.amounts[account.id]?.[month] ?? ""}
                      onChange={event => onDraftChange({
                        ...draft,
                        amounts: {
                          ...draft.amounts,
                          [account.id]: { ...draft.amounts[account.id], [month]: event.target.value },
                        },
                      })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
