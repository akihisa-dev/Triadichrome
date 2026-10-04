import { useRef, useState } from "react";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import appIcon from "../../../branding/logo.svg?no-inline";

type Page = "home" | "initiative-entry";

type HomePageProps = {
  fileName: string;
  onCloseFile: () => void;
};

export function HomePage({ fileName, onCloseFile }: HomePageProps) {
  const sidebar = useRef<HTMLDialogElement>(null);
  const startedOnBackdrop = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState<Page>("home");

  const openSidebar = () => {
    sidebar.current?.showModal();
    setIsSidebarOpen(true);
  };
  const closeSidebar = () => sidebar.current?.close();
  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    closeSidebar();
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <button
          className="home-icon-button"
          type="button"
          aria-label="サイドバーを開く"
          aria-controls="home-sidebar"
          aria-expanded={isSidebarOpen}
          aria-haspopup="dialog"
          onClick={openSidebar}
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
      {page === "home" ? <main className="home-view" aria-label="ホーム" /> : <InitiativeEntryPage />}
      <dialog
        ref={sidebar}
        id="home-sidebar"
        className="sidebar-dialog"
        aria-labelledby="sidebar-title"
        onClose={() => setIsSidebarOpen(false)}
        onPointerDown={(event) => { startedOnBackdrop.current = event.target === event.currentTarget; }}
        onClick={(event) => {
          if (startedOnBackdrop.current && event.target === event.currentTarget) closeSidebar();
          startedOnBackdrop.current = false;
        }}
      >
        <div className="sidebar-panel">
          <header className="sidebar-header">
            <h2 id="sidebar-title">メニュー</h2>
            <button className="home-icon-button" type="button" aria-label="サイドバーを閉じる" onClick={closeSidebar} autoFocus>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="sidebar-file">
            <strong title={fileName}>{fileName}</strong>
          </div>
          <nav className="sidebar-navigation" aria-label="メインナビゲーション">
            <button className="sidebar-item" type="button" aria-current={page === "home" ? "page" : undefined} onClick={() => navigate("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
              </svg>
              <span>Home</span>
            </button>
            <button className="sidebar-item" type="button" aria-current={page === "initiative-entry" ? "page" : undefined} onClick={() => navigate("initiative-entry")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5" />
              </svg>
              <span>施策入力</span>
            </button>
          </nav>
          <footer className="sidebar-footer">
            <button className="sidebar-item" type="button" onClick={() => { closeSidebar(); onCloseFile(); }}>ファイルを閉じる</button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
