type MasterPageProps = { onOpenAccounts: () => void; onOpenAggregations: () => void; onOpenExpansions: () => void };

export function MasterPage({ onOpenAccounts, onOpenAggregations, onOpenExpansions }: MasterPageProps) {
  return <main className="master-page" aria-labelledby="master-title">
    <h1 id="master-title">マスタ</h1>
    <p className="page-description">計画の入力に使う項目を管理します。</p>
    <div className="master-menu">
      <button className="master-menu-item" type="button" onClick={onOpenAccounts}>
        <span><strong>勘定科目マスタ</strong><span>施策の金額入力で選択する勘定科目</span></span>
        <span aria-hidden="true">→</span>
      </button>
      <button className="master-menu-item" type="button" onClick={onOpenAggregations}>
        <span><strong>集計マスタ</strong><span>総原価表で科目・集計をまとめる計算</span></span>
        <span aria-hidden="true">→</span>
      </button>
      <button className="master-menu-item" type="button" onClick={onOpenExpansions}>
        <span><strong>展開マスタ</strong><span>展開コードと展開名</span></span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  </main>;
}
