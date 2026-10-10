import { amountItems, amountItemComposition } from "../core/domain/amountItems";

type Props = { isSaving: boolean; onBack: () => void };

export function AmountItemMasterPage({ isSaving, onBack }: Props) {
  return <main className="master-page account-master-page master-data-page kind-master-page" aria-labelledby="amount-item-master-title">
    <div className="account-master-heading">
      <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
      <h1 id="amount-item-master-title">金額項目マスタ</h1><span className="master-count">{amountItems.length}件</span>
    </div>
    <div className="account-master-list" role="region" aria-label="金額項目一覧" tabIndex={0}>
      <table className="account-master-table" aria-label="金額項目一覧">
        <thead><tr><th scope="col">表示順</th><th scope="col">金額項目</th><th scope="col">構成（科目属性）</th></tr></thead>
        <tbody>{amountItems.map((item, index) => <tr key={item.id}><td>{index + 1}</td><th scope="row">{item.name}</th><td>{amountItemComposition(item)}</td></tr>)}</tbody>
      </table>
    </div>
  </main>;
}
