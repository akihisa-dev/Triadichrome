import { useRef, useState, type DragEvent } from "react";
import { createTriadicDatabase, TRIADIC_FILE_EXTENSION, TRIADIC_MIME_TYPE } from "../core/triadicDatabase";
import { readAccountMaster, type AccountChange } from "../core/accountMaster";
import { saveAccountMaster, type OpenPlan } from "./accountMasterFile";
import { writeTriadicFile } from "./triadicFile";
import { HomePage } from "./HomePage";
import { FadeSwap } from "./FadeSwap";
import { AnimatedHeight } from "./AnimatedHeight";
import appIcon from "../../../branding/logo.svg?no-inline";
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
    const accounts = await readAccountMaster(bytes);
    plan.current = { name: file.name, bytes, accounts, ...(handle ? { handle } : {}) };
    setDisplayName(file.name);
    setFileName(file.name);
  };
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
  const changeMaster = async (change: AccountChange) => {
    if (!plan.current || busy.current) throw new Error("ファイルの処理が終わるまでお待ちください。");
    busy.current = true;
    try {
      const saved = await saveAccountMaster(plan.current, change, () => {
        const picker = (window as PickerWindow).showSaveFilePicker;
        if (!picker) throw new Error("この環境では保存できません。ファイルを保存できるChromeで開いてください。");
        return picker.call(window, { suggestedName: plan.current!.name, types: fileTypes });
      });
      plan.current = saved;
      setDisplayName(saved.name);
      return saved.accounts;
    } finally { busy.current = false; }
  };
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy.current ? "none" : "copy";
    if (!busy.current) setDragging(true);
  };
  return <div className="app-shell"><FadeSwap value={fileName} className="app-switch">{displayedFile => displayedFile
    ? <HomePage fileName={displayName} initialAccounts={plan.current!.accounts} onChangeMaster={changeMaster}
      onCloseFile={() => { if (!busy.current) { setFileName(null); setError(""); setDragging(false); } }} />
    : <main className={`entry-page${dragging ? " is-drag-active" : ""}`} onDragEnter={drag} onDragOver={drag}
    onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
    onDrop={(event) => {
      event.preventDefault(); setDragging(false);
      if (busy.current) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) { setError("一度に開けるファイルは一つです。"); return; }
      void run(() => open(files[0]!));
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
        <div className="entry-actions">
          <button className="entry-open-button" type="button" disabled={isBusy} onClick={choose}>ファイルを開く</button>
          <button className="entry-new-button" type="button" disabled={isBusy} onClick={create}>新規作成</button>
        </div>
      </section>
      <input ref={input} className="entry-file-input" type="file" accept={TRIADIC_FILE_EXTENSION} tabIndex={-1} aria-hidden="true"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(() => open(file)); }} />
      <AnimatedHeight>
        <FadeSwap value={error} className="motion-text">
          {message => message ? <p className="entry-status" role="alert">{message}</p> : null}
        </FadeSwap>
      </AnimatedHeight>
    </div>
  </main>}</FadeSwap></div>;
}
