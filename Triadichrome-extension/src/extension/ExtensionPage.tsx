import { useEffect, useRef, useState, type DragEvent } from "react";
import { createTriadicDatabase, TRIADIC_FILE_EXTENSION, TRIADIC_MIME_TYPE } from "../core/triadicDatabase";
import { type AccountChange } from "../core/accountMaster";
import { saveAccountMaster } from "./accountMasterFile";
import { saveAggregationMaster } from "./aggregationMasterFile";
import { type AggregationChange } from "../core/aggregationMaster";
import { type OpenPlan } from "./planFile";
import { readPlanContents, type InitiativeEntryDraft } from "../core/initiatives";
import { saveInitiative, saveInitiativeUpdate } from "./initiativeFile";
import { writeTriadicFile } from "./triadicFile";
import { loadRecentFile, readRecentFile, rememberRecentFile } from "./recentFile";
import { HomePage } from "./HomePage";
import { FadeSwap } from "./FadeSwap";
import { StatusNotice } from "./StatusNotice";
import appIcon from "../../../branding/logo-512.png?no-inline";
import "./ExtensionPage.css";

type PickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple: boolean; types: typeof fileTypes }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName: string; types: typeof fileTypes }) => Promise<FileSystemFileHandle>;
};
const fileTypes = [{ description: "Triadichrome計画", accept: { [TRIADIC_MIME_TYPE]: [TRIADIC_FILE_EXTENSION] } }];

export function ExtensionPage() {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const plan = useRef<OpenPlan | null>(null);
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
      if (active && revision === recentRevision.current) setRecentNotice("前回のファイルの記憶を読み込めませんでした。「ファイルを開く」から選択してください。");
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
        ? "このファイルの記憶を保存できませんでした。再起動後は「ファイルを開く」から選択してください。"
        : "ファイルの記憶を消去できませんでした。もう一度「記憶を消す」を押してください。");
      if (!handle) throw new Error("ファイルの記憶を消去できませんでした。");
    }
  };
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
    if (!file.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error(".triadicファイルを選択してください。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contents = await readPlanContents(bytes);
    plan.current = { name: file.name, bytes, ...contents, ...(handle ? { handle } : {}) };
    // Failed reads never replace the last successfully opened file.
    if (handle) await remember(handle);
    else {
      try { await remember(null); } catch { /* Opening a file must still succeed. */ }
      setRecentNotice("この開き方ではファイルを記憶できません。「ファイルを開く」から選択するか、保存先を指定して保存してください。");
    }
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
    if (!picker) { input.current?.click(); return; }
    void run(async () => {
      const [handle] = await picker.call(window, { multiple: false, types: fileTypes });
      if (handle) await open(await handle.getFile(), handle);
    });
  };
  const create = () => void run(async () => {
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) throw new Error("この環境ではファイルを新規作成できません。");
    const handle = await picker.call(window, { suggestedName: `Untitled${TRIADIC_FILE_EXTENSION}`, types: fileTypes });
    if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
    const bytes = await createTriadicDatabase();
    await writeTriadicFile(handle, bytes);
    await open(await handle.getFile(), handle);
  });
  const chooseDestination = () => {
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) throw new Error("この環境では保存できません。ファイルを保存できるChromeで開いてください。");
    return picker.call(window, { suggestedName: plan.current!.name, types: fileTypes });
  };
  const prepareSave = async () => {
    if (!plan.current || busy.current) throw new Error("ファイルの処理が終わるまでお待ちください。");
    busy.current = true;
    try {
      const current = plan.current;
      const handle = current.handle ?? await chooseDestination();
      if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
      const permission = handle as FileSystemFileHandle & { requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> };
      if (permission.requestPermission && await permission.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("ファイルへの保存を許可してください。");
      // Preserve the source database and check the separately selected destination for conflicts.
      plan.current = { ...current, handle, ...(!current.handle ? { destinationBytes: new Uint8Array(await (await handle.getFile()).arrayBuffer()) } : {}) };
    } finally { busy.current = false; }
  };
  const saveChange = async (operation: (current: OpenPlan, chooseDestination: () => Promise<FileSystemFileHandle>) => Promise<OpenPlan>, automatic = false) => {
    if (!plan.current || busy.current) throw new Error("ファイルの処理が終わるまでお待ちください。");
    busy.current = true;
    try {
      if (automatic) {
        const handle = plan.current.handle as (FileSystemFileHandle & { queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }) | undefined;
        if (!handle) throw new Error("「保存を再試行」から保存先を選択してください。");
        if (handle.queryPermission && await handle.queryPermission({ mode: "readwrite" }) !== "granted") throw new Error("「保存を再試行」からファイルへの保存を許可してください。");
      }
      const saved = await operation(plan.current, chooseDestination);
      plan.current = saved;
      if (saved.handle && saved.handle !== recentFile) await remember(saved.handle);
      setDisplayName(saved.name);
      return { accounts: saved.accounts, initiatives: saved.initiatives, aggregations: saved.aggregations };
    } finally { busy.current = false; }
  };
  const changeMaster = (change: AccountChange) => saveChange((current, chooseDestination) => saveAccountMaster(current, change, chooseDestination), change.type === "update");
  const changeAggregations = (change: AggregationChange) => saveChange((current, chooseDestination) => saveAggregationMaster(current, change, chooseDestination), change.type === "update");
  const register = (draft: InitiativeEntryDraft) => saveChange((current, chooseDestination) => saveInitiative(current, draft, chooseDestination));
  const update = (id: number, year: number | null, draft: InitiativeEntryDraft) => saveChange(current => saveInitiativeUpdate(current, id, year, draft), true);
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy.current ? "none" : "copy";
    if (!busy.current) setDragging(true);
  };
  return <div className="app-shell"><FadeSwap value={fileName} className="app-switch">{displayedFile => displayedFile
    ? <HomePage fileName={displayName} initialContents={plan.current!} onChangeMaster={changeMaster} onChangeAggregations={changeAggregations} onRegisterInitiative={register} onUpdateInitiative={update} onPrepareSave={prepareSave}
      onCloseFile={() => { if (!busy.current) { setFileName(null); setError(""); setDragging(false); } }} />
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
          await open(await fileHandle.getFile(), fileHandle);
        } else await open(files[0]!);
      });
    }}>
    <div className="entry-content">
      <img className="entry-logo" src={appIcon} width="64" height="64" alt="" draggable={false} />
      <h1 className="entry-title">Triadichrome</h1>
      <section className="entry-drop-zone" aria-label="ファイルを開く・新規作成">
        <svg className="entry-drop-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </svg>
        <div className="entry-drop-title" aria-live="polite"><FadeSwap value={dragging} className="motion-text">{active => active ? "ここで離して開く" : "ここにファイルをドロップ"}</FadeSwap></div>
        <p className="entry-drop-description">.triadicファイルに対応</p>
        <div className="entry-resume">
          <button className="entry-open-button entry-resume-button" type="button" disabled={isBusy || recentLoading || !recentFile}
            aria-describedby="recent-file-name" onClick={resume}>続きから</button>
          <p id="recent-file-name" className="entry-recent-name" title={recentFile?.name}>
            {recentLoading ? "前回のファイルを確認中" : recentFile?.name ?? "前回のファイルはありません"}
          </p>
          <button className="entry-forget-button" type="button" disabled={isBusy || recentLoading || !recentFile}
            onClick={forget}>記憶を消す</button>
        </div>
        <div className="entry-actions">
          <button className="entry-new-button" type="button" disabled={isBusy} onClick={choose}>ファイルを開く</button>
          <button className="entry-new-button" type="button" disabled={isBusy} onClick={create}>新規作成</button>
        </div>
      </section>
      {recentNotice && <p className="entry-recent-notice" role="status">{recentNotice}</p>}
      <input ref={input} className="entry-file-input" type="file" accept={TRIADIC_FILE_EXTENSION} tabIndex={-1} aria-hidden="true"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(() => open(file)); }} />
      <StatusNotice message={error} error onDismiss={() => setError("")} />
    </div>
  </main>}</FadeSwap></div>;
}
