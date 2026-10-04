type MasterPageProps = { onOpenAccounts: () => void };

export function MasterPage({ onOpenAccounts }: MasterPageProps) {
  return <main className="master-page" aria-labelledby="master-title">
    <h1 id="master-title">マスタ</h1>
    <p className="page-description">計画の入力に使う項目を管理します。</p>
    <div className="master-menu">
      <button className="master-menu-item" type="button" onClick={onOpenAccounts}>
        <span><strong>勘定科目マスタ</strong><span>施策の金額入力で選択する勘定科目</span></span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  </main>;
}
