import { useCallback, useEffect, useRef, useState } from "react";
import { InitiativeEntryPage, type InitiativeEntryDraft } from "./InitiativeEntryPage";
import { FadeSwap } from "./FadeSwap";
import { MasterPage } from "./MasterPage";
import { AccountMasterPage } from "./AccountMasterPage";
import { type Account, type AccountChange } from "../core/accountMaster";
import appIcon from "../../../branding/logo.svg?no-inline";

type Page = "home" | "initiative-entry" | "master" | "account-master";

type HomePageProps = {
  fileName: string;
  initialAccounts: Account[];
  onChangeMaster: (change: AccountChange) => Promise<Account[]>;
  onCloseFile: () => void;
};

export function HomePage({ fileName, initialAccounts, onChangeMaster, onCloseFile }: HomePageProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [initiativeDraft, setInitiativeDraft] = useState<InitiativeEntryDraft>({ name: "", note: "", rows: [{ accountId: null, amounts: {} }] });
  const [accounts, setAccounts] = useState(initialAccounts);
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const savingMaster = useRef(false);
  const usedAccountIds = new Set(initiativeDraft.rows.flatMap(row => row.accountId === null ? [] : [row.accountId]));
  const changeMaster = async (change: AccountChange) => {
    if (savingMaster.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && usedAccountIds.has(change.id)) throw new Error("施策入力で使用している勘定科目は削除できません。");
    savingMaster.current = true;
    setIsSavingMaster(true);
    try { setAccounts(await onChangeMaster(change)); }
    finally { savingMaster.current = false; setIsSavingMaster(false); }
  };

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        closeSidebar();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <div className="home-page">
      <header className="home-header">
        <button
          ref={menuButton}
          className="home-icon-button"
          type="button"
          aria-label={isSidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          aria-controls="home-sidebar"
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen(open => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="home-brand">
          <img src={appIcon} width="28" height="28" alt="" draggable={false} />
          Triadichrome
        </span>
        <strong className="home-file-name" title={fileName}>{fileName}</strong>
      </header>
      <div className="home-layout">
        <aside id="home-sidebar" className={`sidebar-panel${isSidebarOpen ? " is-open" : ""}`} aria-labelledby="sidebar-title" aria-hidden={!isSidebarOpen} inert={!isSidebarOpen}>
          <div className="sidebar-inner">
          <header className="sidebar-header">
            <h2 id="sidebar-title">メニュー</h2>
            <button className="home-icon-button" type="button" aria-label="サイドバーを閉じる" onClick={closeSidebar}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="sidebar-file">
            <strong title={fileName}>{fileName}</strong>
          </div>
          <nav className="sidebar-navigation" aria-label="メインナビゲーション">
            <button className="sidebar-item" type="button" disabled={isSavingMaster} aria-current={page === "home" ? "page" : undefined} onClick={() => setPage("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
              </svg>
              <span>Home</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSavingMaster} aria-current={page === "initiative-entry" ? "page" : undefined} onClick={() => setPage("initiative-entry")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5" />
              </svg>
              <span>施策入力</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSavingMaster} aria-current={page === "master" || page === "account-master" ? "page" : undefined} onClick={() => setPage("master")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>マスタ</span>
            </button>
          </nav>
          <footer className="sidebar-footer">
            <button className="sidebar-item" type="button" disabled={isSavingMaster} onClick={onCloseFile}>ファイルを閉じる</button>
          </footer>
          </div>
        </aside>
        <div className="home-content">
          <FadeSwap value={page} className="page-switch">
            {displayed => {
              switch (displayed) {
                case "home": return <main className="home-view" aria-label="ホーム" />;
                case "initiative-entry": return <InitiativeEntryPage draft={initiativeDraft} onDraftChange={setInitiativeDraft} accounts={accounts} onOpenMaster={() => setPage("account-master")} />;
                case "master": return <MasterPage onOpenAccounts={() => setPage("account-master")} />;
                case "account-master": return <AccountMasterPage accounts={accounts} usedAccountIds={usedAccountIds} isSaving={isSavingMaster} onChange={changeMaster} onBack={() => setPage("master")} />;
              }
            }}
          </FadeSwap>
        </div>
      </div>
    </div>
  );
}
