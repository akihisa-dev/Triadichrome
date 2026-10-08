import { type Kind } from "../core/domain/kinds";

type Props = { kinds: Kind[]; isSaving: boolean; onBack: () => void };
export function KindMasterPage({ kinds, onBack, isSaving }: Props) {
  return <main className="master-page account-master-page master-data-page kind-master-page" aria-labelledby="kind-master-title">
    <div className="account-master-heading"><button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="kind-master-title">種別マスタ</h1><span className="master-count">{kinds.length + 1}件</span></div>
    <div className="account-master-list" role="region" aria-label="種別一覧" tabIndex={0}><table className="account-master-table kind-master-table" aria-label="種別一覧">
      <thead><tr><th scope="col">種別</th></tr></thead>
      <tbody><tr><th scope="row">前年</th></tr>{kinds.map(kind => <tr key={kind.id}><th scope="row">{kind.kindName}</th></tr>)}</tbody>
    </table></div>
  </main>;
}
