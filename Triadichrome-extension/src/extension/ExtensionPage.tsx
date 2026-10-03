import { useRef, useState, type DragEvent } from "react";
import { createTriadicDatabase, validateTriadicDatabase, TRIADIC_FILE_EXTENSION, TRIADIC_MIME_TYPE } from "../core/triadicDatabase";
import { writeTriadicFile } from "./triadicFile";
import "./ExtensionPage.css";

function HomeView() {
  return (
    <main className="home-view" aria-label="ホーム">
      <div className="home-triangle" aria-label="作業メニュー">
        <svg
          className="home-triangle-graphic"
          viewBox="0 0 600 540"
          role="img"
          aria-label="3つの画面と施策入力をつなぐ三角形"
        >
          <polygon
            className="home-triangle-surface"
            points="300,70 510,430 90,430"
          />
          <line className="home-triangle-spoke" x1="300" x2="300" y1="310" y2="70" />
          <line className="home-triangle-spoke" x1="300" x2="90" y1="310" y2="430" />
          <line className="home-triangle-spoke" x1="300" x2="510" y1="310" y2="430" />
        </svg>

        <div
          className="home-node home-node-top"
        >
          <span className="home-node-label">明細</span>
        </div>
        <div
          className="home-node home-node-right"
        >
          <span className="home-node-label">総原価表</span>
        </div>
        <div
          className="home-node home-node-left"
        >
          <span className="home-node-label">展開表</span>
        </div>
        <div
          className="home-center-button"
        >
          <span className="home-center-label">施策入力</span>
        </div>
      </div>
    </main>
  );
}


type PickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple: boolean; types: typeof fileTypes }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName: string; types: typeof fileTypes }) => Promise<FileSystemFileHandle>;
};
const fileTypes = [{ description: "Triadichrome計画", accept: { [TRIADIC_MIME_TYPE]: [TRIADIC_FILE_EXTENSION] } }];

export function ExtensionPage() {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
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
  const open = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error(".triadicファイルを選択してください。");
    await validateTriadicDatabase(new Uint8Array(await file.arrayBuffer()));
    setFileName(file.name);
  };
  const choose = () => {
    if (busy.current) return;
    const picker = (window as PickerWindow).showOpenFilePicker;
    if (!picker) { input.current?.click(); return; }
    void run(async () => {
      const [handle] = await picker.call(window, { multiple: false, types: fileTypes });
      if (handle) await open(await handle.getFile());
    });
  };
  const create = () => void run(async () => {
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) throw new Error("この環境ではファイルを新規作成できません。");
    const handle = await picker.call(window, { suggestedName: `新しい計画${TRIADIC_FILE_EXTENSION}`, types: fileTypes });
    if (!handle.name.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION)) throw new Error("拡張子は.triadicにしてください。");
    const bytes = await createTriadicDatabase();
    await writeTriadicFile(handle, bytes);
    await open(await handle.getFile());
  });
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy.current ? "none" : "copy";
    if (!busy.current) setDragging(true);
  };
  if (fileName) return <div className="home-page">
    <header className="home-header"><span>Triadichrome</span><strong title={fileName}>{fileName}</strong>
      <button type="button" onClick={() => { setFileName(null); setError(""); }}>ファイルを閉じる</button>
    </header>
    <HomeView />
  </div>;
  return <main className={`entry-page${dragging ? " is-drag-active" : ""}`} onDragEnter={drag} onDragOver={drag}
    onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
    onDrop={(event) => {
      event.preventDefault(); setDragging(false);
      if (busy.current) return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) { setError("一度に開けるファイルは一つです。"); return; }
      void run(() => open(files[0]!));
    }}>
    <div className="entry-content">
      <h1 className="entry-title">Triadichrome</h1>
      <section className="entry-drop-zone" aria-label="計画を開く">
        <div className="entry-actions">
          <button className="entry-open-button" type="button" disabled={isBusy} onClick={choose}>ファイルを開く</button>
          <button className="entry-new-button" type="button" disabled={isBusy} onClick={create}>新しい計画</button>
        </div>
      </section>
      <input ref={input} className="entry-file-input" type="file" accept={TRIADIC_FILE_EXTENSION} tabIndex={-1} aria-hidden="true"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(() => open(file)); }} />
      {error ? <p className="entry-status" role="alert">{error}</p> : null}
    </div>
  </main>;
}
