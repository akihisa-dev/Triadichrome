import { useCallback, useEffect, useRef, useState } from "react";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import { InitiativeListPage } from "./InitiativeListPage";
import { InitiativeDetailPage } from "./InitiativeDetailPage";
import { createInitiativeDraft, currentFiscalYear, type Initiative, type InitiativeEntryDraft, type PlanContents } from "../core/initiatives";
import { StatusNotice } from "./StatusNotice";
import { FadeSwap } from "./FadeSwap";
import { MasterPage } from "./MasterPage";
import { AccountMasterPage } from "./AccountMasterPage";
import { type AccountChange } from "../core/accountMaster";
import { type AggregationChange } from "../core/aggregationMaster";
import { AggregationMasterPage } from "./AggregationMasterPage";
import { CostTablePage } from "./CostTablePage";
import appIcon from "../../../branding/logo-512.png?no-inline";

type Page = "home" | "initiative-entry" | "initiative-list" | "initiative-detail" | "cost-table" | "master" | "account-master" | "aggregation-master";

type HomePageProps = {
  fileName: string;
  initialContents: PlanContents;
  onChangeMaster: (change: AccountChange) => Promise<PlanContents>;
  onChangeAggregations: (change: AggregationChange) => Promise<PlanContents>;
  onRegisterInitiative: (draft: InitiativeEntryDraft) => Promise<PlanContents>;
  onCloseFile: () => void;
};

export function HomePage({ fileName, initialContents, onChangeMaster, onChangeAggregations, onRegisterInitiative, onCloseFile }: HomePageProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [initiativeDraft, setInitiativeDraft] = useState(createInitiativeDraft);
  const [contents, setContents] = useState(initialContents);
  const { accounts, initiatives } = contents;
  const [selectedInitiative, setSelectedInitiative] = useState<Pick<Initiative, "id" | "fiscalYear"> | null>(null);
  const currentInitiative = initiatives.find(item => item.id === selectedInitiative?.id && item.fiscalYear === selectedInitiative?.fiscalYear);
  const openInitiative = (initiative: Initiative) => {
    dismissNotice();
    setSelectedInitiative({ id: initiative.id, fiscalYear: initiative.fiscalYear });
    setPage("initiative-detail");
  };
  const [listYear, setListYear] = useState(String(initialContents.initiatives[0]?.fiscalYear ?? currentFiscalYear()));
  const [costYear, setCostYear] = useState(String(initialContents.initiatives[0]?.fiscalYear ?? currentFiscalYear()));
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const usedAccountIds = new Set(initiativeDraft.rows.flatMap(row => row.accountId === null ? [] : [row.accountId]));
  const changeMaster = async (change: AccountChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && usedAccountIds.has(change.id)) throw new Error("施策入力で使用している勘定科目は削除できません。");
    saving.current = true;
    setIsSaving(true);
    try { setContents(await onChangeMaster(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };

  const changeAggregations = async (change: AggregationChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true;
    setIsSaving(true);
    try { setContents(await onChangeAggregations(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };

  const register = async () => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    dismissNotice();
    try {
      const saved = await onRegisterInitiative(initiativeDraft);
      setContents(saved);
      setListYear(String(Number(initiativeDraft.fiscalYear)));
      setCostYear(String(Number(initiativeDraft.fiscalYear)));
      setInitiativeDraft(createInitiativeDraft(initiativeDraft.fiscalYear));
      setPage("initiative-list");
      setNotice({ message: "施策を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "施策を登録できませんでした。", error: !cancelled });
    } finally { saving.current = false; setIsSaving(false); }
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
            <button className="sidebar-item" type="button" disabled={isSaving} aria-current={page === "home" ? "page" : undefined} onClick={() => setPage("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
              </svg>
              <span>Home</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSaving} aria-current={page === "initiative-entry" ? "page" : undefined} onClick={() => setPage("initiative-entry")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5" />
              </svg>
              <span>施策入力</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSaving} aria-current={page === "initiative-list" || page === "initiative-detail" ? "page" : undefined} onClick={() => { dismissNotice(); setPage("initiative-list"); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M3 14h18M10 4v16" />
              </svg>
              <span>施策一覧</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSaving} aria-current={page === "cost-table" ? "page" : undefined} onClick={() => { dismissNotice(); setPage("cost-table"); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M3 15h18M11 4v16M16 9v11" />
              </svg>
              <span>総原価表</span>
            </button>
            <button className="sidebar-item" type="button" disabled={isSaving} aria-current={page === "master" || page === "account-master" || page === "aggregation-master" ? "page" : undefined} onClick={() => setPage("master")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>マスタ</span>
            </button>
          </nav>
          <footer className="sidebar-footer">
            <button className="sidebar-item" type="button" disabled={isSaving} onClick={onCloseFile}>ファイルを閉じる</button>
          </footer>
          </div>
        </aside>
        <div className="home-content">
          <FadeSwap value={page} className="page-switch">
            {displayed => {
              switch (displayed) {
                case "home": return <main className="home-view" aria-label="ホーム" />;
                case "initiative-entry": return <InitiativeEntryPage draft={initiativeDraft} onDraftChange={setInitiativeDraft} accounts={accounts} onOpenMaster={() => setPage("account-master")} isSaving={isSaving} onRegister={() => { void register(); }} />;
                case "initiative-detail": return currentInitiative && <InitiativeDetailPage initiative={currentInitiative} accounts={accounts} onBack={() => setPage("initiative-list")} />;
                case "initiative-list": return <InitiativeListPage initiatives={initiatives} fiscalYear={listYear} onYearChange={setListYear} onOpenInitiative={openInitiative} />;
                case "cost-table": return <CostTablePage contents={contents} fiscalYear={costYear} onYearChange={setCostYear} onOpenMaster={() => setPage("aggregation-master")} />;
                case "master": return <MasterPage onOpenAccounts={() => setPage("account-master")} onOpenAggregations={() => setPage("aggregation-master")} />;
                case "aggregation-master": return <AggregationMasterPage accounts={accounts} groups={contents.aggregations} isSaving={isSaving} onChange={changeAggregations} onBack={() => setPage("master")} />;
                case "account-master": return <AccountMasterPage accounts={accounts} usedAccountIds={usedAccountIds} isSaving={isSaving} onChange={changeMaster} onBack={() => setPage("master")} />;
              }
            }}
          </FadeSwap>
        </div>
      </div>
      <StatusNotice {...notice} onDismiss={dismissNotice} />
    </div>
  );
}
