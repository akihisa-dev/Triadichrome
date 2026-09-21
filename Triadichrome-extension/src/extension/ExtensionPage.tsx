import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { Database } from "sql.js";
import manifest from "../../manifest.template.json";
import {
  createTriadicDatabase,
  exportTriadicDatabase,
  openTriadicDatabase,
  TRIADIC_FILE_EXTENSION,
  TRIADIC_MIME_TYPE,
  TriadicFileError,
} from "../core/triadicDatabase";
import { applyBudgetEdit, readBudgetData, type BudgetEdit } from "../core/budgetData";
import { BudgetWorkspace } from "./BudgetWorkspace";
import { persistTriadicFile, requestWritePermission } from "./triadicFile";
import "./ExtensionPage.css";

type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type OpenFilePickerOptions = {
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
  types?: FilePickerAcceptType[];
};

type SaveFilePickerOptions = {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: FilePickerAcceptType[];
};

type FilePickerWindow = Window & {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
};

type FileSystemDropItem = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
};

type DroppedFile = {
  file: File;
  handle?: FileSystemFileHandle;
};

type OpenedFile = {
  name: string;
  database: Database;
  savedBytes: Uint8Array;
  handle?: FileSystemFileHandle;
};

type WorkspaceView =
  | "home"
  | "detail"
  | "cost"
  | "expansion"
  | "initiative";

type WorkspaceSection = Exclude<WorkspaceView, "home">;

type WorkspaceSectionInfo = {
  title: string;
  description: string;
};

const filePickerTypes: FilePickerAcceptType[] = [
  {
    description: "Triadichrome予算データ",
    accept: {
      [TRIADIC_MIME_TYPE]: [TRIADIC_FILE_EXTENSION],
    },
  },
];

const workspaceSections: Record<WorkspaceSection, WorkspaceSectionInfo> = {
  detail: {
    title: "明細",
    description: "費目ごとの明細を確認する画面です。",
  },
  cost: {
    title: "総原価表",
    description: "全体の原価を確認する画面です。",
  },
  expansion: {
    title: "展開表",
    description: "予算の展開を確認する画面です。",
  },
  initiative: {
    title: "施策入力",
    description: "施策を入力する画面です。",
  },
};

function isPickerCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function hasFileDrag(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function hasTriadicExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(TRIADIC_FILE_EXTENSION);
}

async function getDroppedFile(
  item: DataTransferItem,
): Promise<DroppedFile | null> {
  const fileSystemItem = item as FileSystemDropItem;
  // Read during the drop event; browsers stop exposing the item after an await.
  const file = item.getAsFile();

  if (fileSystemItem.getAsFileSystemHandle) {
    try {
      const handle = await fileSystemItem.getAsFileSystemHandle();

      if (handle?.kind === "file") {
        const fileHandle = handle as FileSystemFileHandle;

        return {
          file: await fileHandle.getFile(),
          handle: fileHandle,
        };
      }
    } catch {
      // Some browsers expose the method but cannot provide a handle for every
      // drag source. The regular File fallback below still supports the drop.
    }
  }

  return file ? { file } : null;
}

type WorkspaceLayoutProps = {
  fileName: string;
  isBusy: boolean;
  status: string;
  onSaveAs: () => void;
  children: React.ReactNode;
};

function WorkspaceLayout({
  fileName,
  isBusy,
  status,
  onSaveAs,
  children,
}: WorkspaceLayoutProps): React.JSX.Element {
  return (
    <main className="workspace-page">
      <div className="workspace-shell">
        <header className="workspace-header">
          <div className="workspace-brand">
            <span className="workspace-brand-mark" aria-hidden="true">
              △
            </span>
            <div>
              <p className="workspace-brand-name">Triadichrome</p>
              <p className="workspace-brand-caption">予算データワークスペース</p>
            </div>
          </div>
          <div className="workspace-file" title={fileName}>
            <span className="workspace-file-label">現在のデータ</span>
            <strong className="workspace-file-name">{fileName}</strong>
            <button
              className="workspace-save-button"
              type="button"
              onClick={onSaveAs}
              disabled={isBusy}
            >
              {isBusy ? "保存中…" : "別名で保存"}
            </button>
          </div>
        </header>
        <p className="workspace-status" role="status" aria-live="polite">
          {status}
        </p>
        {children}
      </div>
    </main>
  );
}

type HomeViewProps = {
  onNavigate: (view: WorkspaceView) => void;
};

function HomeView({ onNavigate }: HomeViewProps): React.JSX.Element {
  return (
    <section className="home-view" aria-labelledby="home-title">
      <div className="home-intro">
        <p className="workspace-eyebrow">HOME</p>
        <h1 id="home-title" className="home-title">
          作業メニュー
        </h1>
        <p className="home-description">
          三角形のメニューから、確認したい画面を選択してください。
        </p>
      </div>

      <div className="home-triangle" aria-label="作業メニュー">
        <svg
          className="home-triangle-graphic"
          viewBox="0 0 600 540"
          role="img"
          aria-label="3つの画面と施策入力をつなぐ三角形"
        >
          <defs>
            <linearGradient id="triangle-fill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#f4fbfa" />
              <stop offset="1" stopColor="#e2eff2" />
            </linearGradient>
          </defs>
          <polygon
            className="home-triangle-surface"
            points="300,20 575,505 25,505"
            fill="url(#triangle-fill)"
          />
          <line className="home-triangle-spoke" x1="300" x2="300" y1="275" y2="20" />
          <line className="home-triangle-spoke" x1="300" x2="25" y1="275" y2="505" />
          <line className="home-triangle-spoke" x1="300" x2="575" y1="275" y2="505" />
        </svg>

        <button
          className="home-node home-node-top"
          type="button"
          onClick={() => onNavigate("detail")}
          aria-label="1 明細へ移動"
        >
          <span className="home-node-number">1</span>
          <span className="home-node-label">明細</span>
        </button>
        <button
          className="home-node home-node-right"
          type="button"
          onClick={() => onNavigate("cost")}
          aria-label="2 総原価表へ移動"
        >
          <span className="home-node-number">2</span>
          <span className="home-node-label">総原価表</span>
        </button>
        <button
          className="home-node home-node-left"
          type="button"
          onClick={() => onNavigate("expansion")}
          aria-label="3 展開表へ移動"
        >
          <span className="home-node-number">3</span>
          <span className="home-node-label">展開表</span>
        </button>
        <button
          className="home-center-button"
          type="button"
          onClick={() => onNavigate("initiative")}
          aria-label="施策入力へ移動"
        >
          <span className="home-center-kicker">中央メニュー</span>
          <span className="home-center-label">施策入力</span>
          <span className="home-center-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
      <p className="home-hint">中央のボタンから施策入力モードへ移動できます。</p>
    </section>
  );
}

export function ExtensionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("home");
  const [status, setStatus] = useState(
    "ファイルをドロップするか、ボタンから選択してください。",
  );

  const database = openedFile?.database;
  useEffect(() => () => database?.close(), [database]);
  const budgetData = useMemo(() => database ? readBudgetData(database) : null, [database, revision]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const beginOperation = (): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setIsBusy(true);
    return true;
  };

  const endOperation = (): void => {
    busyRef.current = false;
    setIsBusy(false);
  };

  const openFile = async (
    file: File,
    fileHandle?: FileSystemFileHandle,
  ): Promise<void> => {
    try {
      if (!hasTriadicExtension(file.name)) {
        throw new TriadicFileError(
          `Triadichromeで開けるのは${TRIADIC_FILE_EXTENSION}ファイルだけです。`,
        );
      }

      const databaseBytes = new Uint8Array(await file.arrayBuffer());
      const loadedDatabase = await openTriadicDatabase(databaseBytes);

      if (fileHandle) {
        setOpenedFile({
          name: file.name,
          database: loadedDatabase,
          savedBytes: databaseBytes,
          handle: fileHandle,
        });
      } else {
        setOpenedFile({ name: file.name, database: loadedDatabase, savedBytes: databaseBytes });
      }
      setActiveView("home");
      setStatus(`「${file.name}」を開きました。`);
    } catch (error) {
      console.error("ファイルを開けませんでした。", error);
      setStatus(
        error instanceof TriadicFileError
          ? error.message
          : "ファイルを開けませんでした。読み取り権限を確認してください。",
      );
    }
  };

  const handleOpen = async (): Promise<void> => {
    if (busyRef.current) return;
    const filePickerWindow = window as FilePickerWindow;

    if (!filePickerWindow.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }

    if (!beginOperation()) return;

    try {
      const [fileHandle] = await filePickerWindow.showOpenFilePicker({
        multiple: false,
        types: filePickerTypes,
      });

      if (!fileHandle) {
        return;
      }

      const file = await fileHandle.getFile();
      await openFile(file, fileHandle);
    } catch (error) {
      if (!isPickerCancellation(error)) {
        console.error("ファイル選択を開始できませんでした。", error);
        setStatus("ファイルを開けませんでした。もう一度お試しください。");
      }
    } finally {
      endOperation();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const [file] = event.target.files ?? [];
    event.target.value = "";

    if (file && beginOperation()) {
      void openFile(file).finally(endOperation);
    }
  };

  const handleCreate = async (): Promise<void> => {
    const filePickerWindow = window as FilePickerWindow;

    if (!filePickerWindow.showSaveFilePicker) {
      setStatus("この環境では保存先を選択できません。Chromeでお試しください。");
      return;
    }

    if (!beginOperation()) return;
    let picked = false;
    try {
      const fileHandle = await filePickerWindow.showSaveFilePicker({
        suggestedName: `新しい予算データ${TRIADIC_FILE_EXTENSION}`,
        types: filePickerTypes,
      });
      picked = true;
      if (!hasTriadicExtension(fileHandle.name)) {
        throw new TriadicFileError(
          `保存先の拡張子は${TRIADIC_FILE_EXTENSION}にしてください。`,
        );
      }
      const databaseBytes = await createTriadicDatabase();
      await persistTriadicFile(fileHandle, databaseBytes);

      const savedFile = await fileHandle.getFile();
      const createdDatabase = await openTriadicDatabase(
        new Uint8Array(await savedFile.arrayBuffer()),
      );

      setOpenedFile({
        name: fileHandle.name,
        database: createdDatabase,
        savedBytes: databaseBytes,
        handle: fileHandle,
      });
      setActiveView("home");
      setStatus(`「${fileHandle.name}」を新規作成しました。`);
    } catch (error) {
      if (picked || !isPickerCancellation(error)) {
        console.error("新規データを作成できませんでした。", error);
        setStatus(
          error instanceof TriadicFileError
            ? error.message
            : "新規データを作成できませんでした。保存先を確認してください。",
        );
      }
    } finally {
      endOperation();
    }
  };

  const handleSaveAs = async (): Promise<void> => {
    if (!openedFile) return;
    const filePickerWindow = window as FilePickerWindow;
    if (!filePickerWindow.showSaveFilePicker) {
      setStatus("この環境では保存先を選択できません。Chromeでお試しください。");
      return;
    }
    if (!beginOperation()) return;
    let picked = false;
    try {
      const fileHandle = await filePickerWindow.showSaveFilePicker({
        suggestedName: openedFile.name,
        types: filePickerTypes,
      });
      picked = true;
      if (!hasTriadicExtension(fileHandle.name)) {
        throw new TriadicFileError(
          `保存先の拡張子は${TRIADIC_FILE_EXTENSION}にしてください。`,
        );
      }
      const bytes = exportTriadicDatabase(openedFile.database);
      const sameFile = openedFile.handle && await fileHandle.isSameEntry(openedFile.handle);
      await persistTriadicFile(fileHandle, bytes, sameFile ? openedFile.savedBytes : undefined);
      setOpenedFile({ ...openedFile, name: fileHandle.name, handle: fileHandle, savedBytes: bytes });
      setDirty(false);
      setStatus(`「${fileHandle.name}」に保存しました。`);
    } catch (error) {
      if (picked || !isPickerCancellation(error)) {
        setStatus(
          error instanceof Error && !(error instanceof DOMException)
            ? error.message
            : "保存できませんでした。開いているデータは保持しています。保存先を確認して、もう一度お試しください。",
        );
      }
    } finally {
      endOperation();
    }
  };

  const saveCurrent = async (file: OpenedFile): Promise<void> => {
    if (!file.handle) throw new Error("先に「別名で保存」で保存先を選んでください。");
    const bytes = exportTriadicDatabase(file.database);
    await persistTriadicFile(file.handle, bytes, file.savedBytes);
    setOpenedFile({ ...file, savedBytes: bytes });
    setDirty(false);
    setStatus("すべての変更を保存しました。");
  };

  const reportSaveError = (error: unknown): void => {
    setStatus(error instanceof Error && !(error instanceof DOMException)
      ? error.message
      : "保存できませんでした。編集内容は保持しています。再試行するか、別名で保存してください。");
  };

  const handleEdit = async (edit: BudgetEdit): Promise<boolean> => {
    if (!openedFile?.handle || !beginOperation()) return false;
    let applied = false;
    try {
      await requestWritePermission(openedFile.handle);
      applyBudgetEdit(openedFile.database, edit);
      applied = true;
      setDirty(true);
      setRevision((value) => value + 1);
      setStatus("保存中…");
      await saveCurrent(openedFile);
    } catch (error) {
      reportSaveError(error);
    } finally {
      endOperation();
    }
    return applied;
  };

  const handleRetrySave = async (): Promise<void> => {
    if (!openedFile?.handle || !beginOperation()) return;
    try {
      await requestWritePermission(openedFile.handle);
      await saveCurrent(openedFile);
    } catch (error) {
      reportSaveError(error);
    } finally {
      endOperation();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = busyRef.current ? "none" : "copy";
    if (busyRef.current) return;
    setIsDragActive(true);
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (hasFileDrag(event)) {
      event.preventDefault();
      if (busyRef.current) return;
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    const relatedTarget = event.relatedTarget;

    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setIsDragActive(false);

    if (busyRef.current) return;
    const fileItems = Array.from(event.dataTransfer.items).filter(
      (item) => item.kind === "file",
    );
    if (fileItems.length > 1 || event.dataTransfer.files.length > 1) {
      setStatus("予算データは一つずつ開いてください。");
      return;
    }
    const fileItem = fileItems[0];

    if (fileItem) {
      if (!beginOperation()) return;
      void getDroppedFile(fileItem).then(async (droppedFile) => {
        if (!droppedFile) {
          setStatus("ファイルを読み取れませんでした。別のファイルをお試しください。");
          return;
        }

        if (droppedFile.handle) {
          await openFile(droppedFile.file, droppedFile.handle);
        } else {
          await openFile(droppedFile.file);
        }
      }).catch(() => {
        setStatus("ファイルを読み取れませんでした。ボタンから選択してください。");
      }).finally(endOperation);
      return;
    }

    const [file] = Array.from(event.dataTransfer.files);
    if (file && beginOperation()) {
      void openFile(file).finally(endOperation);
    } else {
      setStatus("ファイルをドロップしてください。");
    }
  };

  if (openedFile && budgetData) {
    return (
      <WorkspaceLayout
        fileName={openedFile.name}
        isBusy={isBusy}
        status={status}
        onSaveAs={() => void handleSaveAs()}
      >
        <nav className="budget-nav" aria-label="画面の切り替え">
          <button type="button" aria-current={activeView === "home" ? "page" : undefined}
            onClick={() => setActiveView("home")}>ホーム</button>
          {(Object.keys(workspaceSections) as WorkspaceSection[]).map((section) =>
            <button key={section} type="button" aria-current={activeView === section ? "page" : undefined}
              onClick={() => setActiveView(section)}>{workspaceSections[section].title}</button>)}
        </nav>
        {!openedFile.handle ? <p className="save-notice">編集するには「別名で保存」で保存先を選んでください。</p> : null}
        {dirty ? <p className="save-notice" role="status">{isBusy ? "変更を保存しています。" : "未保存の変更があります。"}
          <button type="button" disabled={isBusy} onClick={() => void handleRetrySave()}>保存を再試行</button>
        </p> : null}
        {activeView === "home" ? (
          <HomeView onNavigate={setActiveView} />
        ) : (
          <BudgetWorkspace
            section={activeView}
            data={budgetData}
            disabled={isBusy || !openedFile.handle}
            onEdit={handleEdit}
          />
        )}
      </WorkspaceLayout>
    );
  }

  return (
    <main
      className={`entry-page${isDragActive ? " is-drag-active" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="entry-content">
        <h1 className="entry-title">Triadichrome</h1>
        <p className="entry-version">v{manifest.version}</p>
        <section className="entry-drop-zone" aria-label="予算データを開く">
          <p className="entry-drop-title">予算データを開く</p>
          <p className="entry-drop-description">
            ファイルをここへドロップ
            <br />
            またはボタンから選択
          </p>
          <div className="entry-actions">
            <button
              className="entry-open-button"
              type="button"
              onClick={() => void handleOpen()}
              disabled={isBusy}
            >
              ファイルを開く
            </button>
            <button
              className="entry-new-button"
              type="button"
              onClick={() => void handleCreate()}
              disabled={isBusy}
            >
              新規データを作成
            </button>
          </div>
        </section>
        <input
          ref={fileInputRef}
          className="entry-file-input"
          type="file"
          accept={TRIADIC_FILE_EXTENSION}
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
        <p className="entry-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </main>
  );
}
