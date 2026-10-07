import { type Kind } from "../core/domain/kinds";

type Props = { kinds: Kind[]; isSaving: boolean; onBack: () => void };
export function KindMasterPage({ kinds, onBack, isSaving }: Props) {
  return <main className="master-page" aria-labelledby="kind-master-title">
    <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="kind-master-title">種別マスタ</h1>
    <div className="account-master-list"><table className="account-master-table" aria-label="種別一覧">
      <thead><tr><th scope="col">種別</th></tr></thead>
      <tbody><tr><th scope="row">前年</th></tr>{kinds.map(kind => <tr key={kind.id}><th scope="row">{kind.kindName}</th></tr>)}</tbody>
    </table></div>
  </main>;
}
