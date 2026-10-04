import { type Account } from "../core/accountMaster";
import { initiativeMonths, type Initiative } from "../core/initiatives";

type InitiativeDetailPageProps = {
  initiative: Initiative;
  accounts: Account[];
  onBack: () => void;
};

export function InitiativeDetailPage({ initiative, accounts, onBack }: InitiativeDetailPageProps) {
  return <main className="initiative-entry-page" aria-labelledby="initiative-detail-title">
    <button className="text-button master-back" type="button" onClick={onBack}>← 施策一覧へ戻る</button>
    <h1 id="initiative-detail-title">施策詳細</h1>
    <div className="initiative-field">
      <label htmlFor="initiative-detail-name">施策名</label>
      <input id="initiative-detail-name" value={initiative.name} readOnly />
    </div>
    <div className="initiative-field">
      <label htmlFor="initiative-detail-note">備考</label>
      <input id="initiative-detail-note" value={initiative.note} readOnly />
    </div>
    <div className="initiative-field initiative-year-field">
      <label htmlFor="initiative-detail-year">年度</label>
      <input id="initiative-detail-year" value={initiative.fiscalYear ?? "年度未設定"} readOnly aria-describedby="initiative-detail-year-hint" />
      <span id="initiative-detail-year-hint" className="field-hint">4月〜翌3月</span>
    </div>
    <div className="initiative-amount-table-container" role="region" aria-label="登録済みの月別計画金額" tabIndex={0}>
      <table className="initiative-amount-table" aria-label="月別計画金額">
        <thead><tr>
          <th scope="col">勘定科目</th>
          {initiativeMonths.map(month => <th key={month} scope="col">{month}月</th>)}
        </tr></thead>
        <tbody>{initiative.rows.map((row, index) => {
          const account = accounts.find(item => item.id === row.accountId);
          const accountName = account?.accountName ?? `${index + 1}行目`;
          return <tr key={index}>
            <th scope="row"><span className="initiative-detail-account">{account ? `${account.accountCode ?? "未設定"} ${account.accountName}` : "未設定"}</span></th>
            {initiativeMonths.map(month => <td key={month}>
              <input type="number" step="any" aria-label={`${accountName} ${month}月の金額`} value={row.amounts[month] ?? ""} readOnly />
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
  </main>;
}
