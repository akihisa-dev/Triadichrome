import { version as appVersion } from "../../../package.json";
import type { PlanChange } from "../core/domain/kinds";
import type { PlanCommand } from "./planCommands";
import { type PeriodTypeChange } from "../core/domain/periodMaster";
import { type DepartmentChange } from "../core/domain/departmentMaster";
import { type IndustryChange } from "../core/domain/industryMaster";
import { type ExpansionChange } from "../core/domain/expansionMaster";
import { type HistoryDeletion } from "../core/storage/dataHistory";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { createTriadicDatabase } from "./planProcessing";
import { TRIADIC_FILE_EXTENSION } from "../core/storage/triadicSchema";
import { type AccountChange } from "../core/domain/accountMaster";
import { type AggregationChange } from "../core/domain/aggregationMaster";
import { currentFiscalYear } from "../core/domain/calendar";
import { readPlanContents } from "./planProcessing";
import { type InitiativeEntryDraft } from "../core/domain/plan";
import { writeTriadicFile } from "./triadicFile";
import { loadRecentFile, readRecentFile, rememberRecentFile } from "./recentFile";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { FiscalYearSlot } from "./FiscalYearSlot";
import { HomePage } from "./HomePage";
import { FadeSwap } from "./FadeSwap";
import { StatusNotice } from "./StatusNotice";
import appIcon from "../../../branding/logo-512.png?no-inline";
import "./ExtensionPage.css";

import { choosePlanDestination, fileTypes, type PickerWindow } from "./filePicker";
import { usePlanSession } from "./usePlanSession";

export function ExtensionPage() {
  const busy = useRef(false);
  const [closeError, setCloseError] = useState("");
  const [closeRequested, setCloseRequested] = useState(false);
  const suggestedName = useRef("Untitled.triadic");
  const chooseDestination = useCallback(() => choosePlanDestination(suggestedName.current), []);
  const { session, snapshot } = usePlanSession(chooseDestination, closeRequested);
  const { history: dataHistory, historyError } = snapshot;
  if (snapshot.name) suggestedName.current = snapshot.name;
  // Keep the outgoing screen's published contents for the fade, without retaining an open document.
  const displayedContents = useRef(snapshot.contents);
  if (snapshot.contents) displayedContents.current = snapshot.contents;

  useEffect(() => {
    const confirmExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmExit);
    return () => window.removeEventListener("beforeunload", confirmExit);
  }, []);
  const [isBusy, setIsBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [recentFile, setRecentFile] = useState<FileSystemFileHandle | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentNotice, setRecentNotice] = useState("");
  const recentRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const revision = recentRevision.current;
    void loadRecentFile().then(handle => {
      if (active && revision === recentRevision.current) setRecentFile(handle);
    }).catch(() => {
      if (active && revision === recentRevision.current) setRecentNotice("前回のファイル履歴を読み込めませんでした。「ファイルを開く」から選択してください。");
    }).finally(() => { if (active) setRecentLoading(false); });
    return () => { active = false; };
  }, []);
  const remember = async (handle: FileSystemFileHandle | null) => {
    recentRevision.current++;
    setRecentNotice("");
    try {
      await rememberRecentFile(handle);
      setRecentFile(handle);
    }
    catch {
      if (handle) setRecentFile(handle);
      setRecentNotice(handle
        ? "このファイルの履歴を保存できませんでした。再起動後は「ファイルを開く」から選択してください。"
        : "ファイル履歴を消去できませんでした。もう一度「履歴を消す」を押してください。");
      if (!handle) throw new Error("ファイル履歴を消去できませんでした。");
    }
  };
  useEffect(() => {
    if (snapshot.name) setDisplayName(snapshot.name);
  }, [snapshot.name]);
  const run = async (operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setError("");
    try { await operation(); }
    catch (failure) {
      if (!(failure instanceof DOMException && failure.name === "AbortError")) {
        setError(failure instanceof Error ? failure.message : "ファイルを開けませんでした。");
      }
    } finally { busy.current = false; setIsBusy(false); }
  };
  const open = async (file: File, handle?: FileSystemFileHandle) => {
    if (!handle) throw new Error("この開き方では自動保存できません。「ファイルを開く」から選択してください。");
    if (!file.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error(".triadicファイルを選択してください。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contents = await readPlanContents(bytes);
    await session.open({ name: file.name, bytes, ...contents, ...(handle ? { handle } : {}) });
    setCloseError("");
    // Failed reads and denied write access never replace the last opened file.
    await remember(handle);
    setDisplayName(file.name);
    setFileName(file.name);
  };
  const resume = () => void run(async () => {
    if (recentFile) await open(await readRecentFile(recentFile), recentFile);
  });
  const forget = () => void run(() => remember(null));
  const choose = () => {
    if (busy.current) return;
    const picker = (window as PickerWindow).showOpenFilePicker;
    if (!picker) { setError("この環境では自動保存できません。ファイルを読み書きできるChromeで開いてください。"); return; }
    void run(async () => {
      const [handle] = await picker.call(window, { multiple: false, mode: "readwrite", types: fileTypes });
      if (handle) await open(await readRecentFile(handle), handle);
    });
  };
  const [newFiscalYear, setNewFiscalYear] = useState(String(currentFiscalYear()));
  const create = () => void run(async () => {
    if (!/^\d{1,4}$/.test(newFiscalYear) || Number(newFiscalYear) < 1 || Number(newFiscalYear) > 9998) throw new Error("年度は1〜9998の整数で入力してください。");
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) throw new Error("この環境ではファイルを新規作成できません。");
    const handle = await picker.call(window, { suggestedName: `Untitled${TRIADIC_FILE_EXTENSION}`, types: fileTypes });
    if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
    const bytes = await createTriadicDatabase(Number(newFiscalYear));
    await writeTriadicFile(handle, bytes);
    await open(await readRecentFile(handle), handle);
  });
  const prepareSave = () => session.prepareSave(chooseDestination);
  const dispatch = async (command: PlanCommand) => {
    const contents = await session.dispatch(command, chooseDestination);
    const handle = session.getHandle();
    if (handle && handle !== recentFile) await remember(handle);
    return contents;
  };
  const changePlan = (change: PlanChange) => dispatch({ type: "settings", change });
  const changeMaster = (change: AccountChange) => dispatch({ type: "account", change });
  const changePeriodTypes = (change: PeriodTypeChange) => dispatch({ type: "period", change });
  const changeDepartments = (change: DepartmentChange) => dispatch({ type: "department", change });
  const changeIndustries = (change: IndustryChange) => dispatch({ type: "industry", change });
  const changeExpansions = (change: ExpansionChange) => dispatch({ type: "expansion", change });
  const changeAggregations = (change: AggregationChange) => dispatch({ type: "aggregation", change });
  const register = (draft: InitiativeEntryDraft) => dispatch({ type: "initiative.register", draft });
  const update = (id: number, _year: number | null, draft: InitiativeEntryDraft) => dispatch({ type: "initiative.update", id, draft });
  const previewHistory = (id: number) => session.preview(id, chooseDestination);
  const restoreHistory = (id: number) => session.restore(id, chooseDestination);
  const deleteHistory = (deletion: HistoryDeletion) => session.deleteHistory(deletion, chooseDestination);
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy.current ? "none" : "copy";
    if (!busy.current) setDragging(true);
  };
  return <div className="app-shell"><FadeSwap value={fileName} className="app-switch">{displayedFile => displayedFile
    ? <HomePage onChangePlan={changePlan} fileName={displayName} initialContents={displayedContents.current!} onChangeMaster={changeMaster} onChangeAggregations={changeAggregations} onChangeExpansions={changeExpansions} onChangeIndustries={changeIndustries} onChangeDepartments={changeDepartments} onChangePeriodTypes={changePeriodTypes} onRegisterInitiative={register} onUpdateInitiative={update} onPrepareSave={prepareSave}
      dataHistory={dataHistory} historyError={historyError} historyBusy={isBusy || snapshot.busy} onPreviewHistory={previewHistory} onRestoreHistory={restoreHistory} onDeleteHistory={deleteHistory}
      canUndo={snapshot.canUndo} canRedo={snapshot.canRedo} operationRevision={snapshot.operationRevision} onTravelOperation={direction => session.travelOperation(direction, chooseDestination)}
      onRetryHistory={async () => { await prepareSave(); await session.checkpoint(true, chooseDestination); }}
      onCloseFile={() => { if (!busy.current) { setCloseError(""); setCloseRequested(true); } }} />
    : <main className={`entry-page${dragging ? " is-drag-active" : ""}`} onDragEnter={drag} onDragOver={drag}
    onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
    onDrop={(event) => {
      event.preventDefault(); setDragging(false);
      if (busy.current) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) { setError("一度に開けるファイルは一つです。"); return; }
      // Capture the handle promise during the drop event, before awaiting anything.
      const item = Array.from(event.dataTransfer.items).find(entry => entry.kind === "file") as
        (DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }) | undefined;
      const droppedHandle = item?.getAsFileSystemHandle?.();
      void run(async () => {
        const handle = await droppedHandle?.catch(() => null);
        if (handle?.kind === "file") {
          const fileHandle = handle as FileSystemFileHandle;
          await open(await readRecentFile(fileHandle), fileHandle);
        } else await open(files[0]!);
      });
    }}>
    <div className="entry-content">
      <header className="entry-brand">
        <img className="entry-logo" src={appIcon} width="40" height="40" alt="" draggable={false} />
        <h1 className="entry-title">Triadichrome</h1>
        <span className="app-version" aria-label={`バージョン ${appVersion}`}>v{appVersion}</span>
      </header>
      <section className="entry-drop-zone" aria-label="ファイルを開く・新規作成">
        <div className={`entry-resume${recentFile ? " has-recent" : ""}`}>
          <div className="entry-recent-heading">
            <span className="entry-recent-label">前回の計画</span>
            <button className="entry-forget-button" type="button" disabled={isBusy || recentLoading || !recentFile}
              onClick={forget}>履歴を消す</button>
          </div>
          <div className="entry-recent-row">
            <svg className="entry-file-icon" width="40" height="48" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true"><path d="M7 2h12l8 8v27H7zM19 2v9h8M12 20h10M12 25h10M12 30h6" /></svg>
            <p id="recent-file-name" className="entry-recent-name" title={recentFile?.name}>
              {recentLoading ? "確認中…" : recentFile?.name ?? "まだ開いていません"}
            </p>
            <button className="entry-open-button entry-resume-button" type="button" disabled={isBusy || recentLoading || !recentFile}
              aria-describedby="recent-file-name" onClick={resume}>続きから<span aria-hidden="true">↗</span></button>
          </div>
        </div>
        <div className="entry-options">
          <div className="entry-open-section">
            <svg className="entry-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3z" /><path d="M3 10h18" /></svg>
            <h2 className="entry-drop-title" aria-live="polite"><FadeSwap value={dragging} className="motion-text">{active => active ? "ここにドロップして開く" : "ファイルを開く"}</FadeSwap></h2>
            <p className="entry-drop-description">.triadicファイルをここにドロップ</p>
            <button className="entry-new-button" type="button" disabled={isBusy} onClick={choose}>ファイルを開く<span aria-hidden="true">→</span></button>
          </div>
          <div className="entry-create-section">
            <svg className="entry-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 14h6m-3-3v6" /></svg>
            <h2 className="entry-section-title">新しい計画</h2>
            <FiscalYearSlot value={Number(newFiscalYear)} onChange={year => setNewFiscalYear(String(year))} disabled={isBusy} />
            <button className="entry-new-button" type="button" disabled={isBusy} onClick={create}>新規作成<span aria-hidden="true">＋</span></button>
          </div>
        </div>
      </section>
      {recentNotice && <p className="entry-recent-notice" role="status">{recentNotice}</p>}
      <StatusNotice message={error} error onDismiss={() => setError("")} />
    </div>
  </main>}</FadeSwap>
    <ConfirmationDialog open={closeRequested} title="ファイルを閉じる" message={closeError || `「${displayName}」を閉じますか？ 登録前の入力は失われます。`} confirmLabel={closeError ? "保存を再試行して閉じる" : "閉じる"} busy={isBusy || snapshot.busy}
      onCancel={() => setCloseRequested(false)} onConfirm={() => {
        if (busy.current) return;
        void (async () => {
          try {
            if (closeError) await prepareSave();
            await session.close(chooseDestination);
            setCloseRequested(false); setFileName(null); setError(""); setDragging(false);
          } catch (failure) { setCloseError(failure instanceof Error ? failure.message : "履歴を記録できませんでした。ファイルは開いたままです。"); }
        })();
      }} />
  </div>;
}
