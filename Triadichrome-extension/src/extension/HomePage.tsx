import { useRef, useState } from "react";
import appIcon from "../../../branding/logo.svg?no-inline";

type HomePageProps = {
  fileName: string;
  onCloseFile: () => void;
};

export function HomePage({ fileName, onCloseFile }: HomePageProps) {
  const sidebar = useRef<HTMLDialogElement>(null);
  const startedOnBackdrop = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = () => {
    sidebar.current?.showModal();
    setIsSidebarOpen(true);
  };
  const closeSidebar = () => sidebar.current?.close();

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
      <main className="home-view" aria-label="ホーム" />
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
            <span>開いている計画</span>
            <strong title={fileName}>{fileName}</strong>
          </div>
          <nav className="sidebar-navigation" aria-label="メインナビゲーション">
            <button className="sidebar-item" type="button" aria-current="page" onClick={closeSidebar}>ホーム</button>
          </nav>
          <footer className="sidebar-footer">
            <button className="sidebar-item" type="button" onClick={() => { closeSidebar(); onCloseFile(); }}>ファイルを閉じる</button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
