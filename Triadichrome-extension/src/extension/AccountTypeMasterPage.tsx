import { accountTypes } from "../core/domain/accountTypes";

type Props = { isSaving: boolean; onBack: () => void };

export function AccountTypeMasterPage({ isSaving, onBack }: Props) {
  const items = Object.entries(accountTypes);
  return <main className="master-page account-master-page master-data-page kind-master-page" aria-labelledby="account-type-master-title">
    <div className="account-master-heading">
      <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
      <h1 id="account-type-master-title">科目属性マスタ</h1><span className="master-count">{items.length}件</span>
    </div>
    <div className="account-master-list" role="region" aria-label="科目属性一覧" tabIndex={0}>
      <table className="account-master-table kind-master-table" aria-label="科目属性一覧">
        <thead><tr><th scope="col">科目属性</th></tr></thead>
        <tbody>{items.map(([id, name]) => <tr key={id}><th scope="row">{name}</th></tr>)}</tbody>
      </table>
    </div>
  </main>;
}
