import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import manifest from "../../manifest.template.json";
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
  size: number;
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
      "application/json": [".json"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
  },
];

const initialDocument = "{}\n";

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

async function getDroppedFile(
  item: DataTransferItem,
): Promise<DroppedFile | null> {
  const fileSystemItem = item as FileSystemDropItem;

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

  const file = item.getAsFile();
  return file ? { file } : null;
}

type WorkspaceLayoutProps = {
  fileName: string;
  children: React.ReactNode;
};

function WorkspaceLayout({
  fileName,
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
          </div>
        </header>
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

type WorkspacePlaceholderProps = {
  section: WorkspaceSection;
  onHome: () => void;
};

function WorkspacePlaceholder({
  section,
  onHome,
}: WorkspacePlaceholderProps): React.JSX.Element {
  const sectionInfo = workspaceSections[section];

  return (
    <section className="workspace-view" aria-labelledby="workspace-view-title">
      <button className="screen-back-button" type="button" onClick={onHome}>
        <span aria-hidden="true">←</span> ホームへ戻る
      </button>
      <div className="screen-heading">
        <p className="workspace-eyebrow">WORKSPACE</p>
        <h1 id="workspace-view-title" className="screen-title">
          {sectionInfo.title}
        </h1>
        <p className="screen-description">{sectionInfo.description}</p>
      </div>
      <div className="screen-frame" aria-label={`${sectionInfo.title}画面の枠`}>
        <div className="screen-frame-content">
          <span className="screen-frame-icon" aria-hidden="true">
            △
          </span>
          <p className="screen-frame-title">{sectionInfo.title}画面</p>
          <p className="screen-frame-description">
            この画面の枠です。入力欄やデータ表示は今後追加します。
          </p>
        </div>
      </div>
    </section>
  );
}

export function ExtensionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("home");
  const [status, setStatus] = useState(
    "ファイルをドロップするか、ボタンから選択してください。",
  );

  const openFile = async (
    file: File,
    fileHandle?: FileSystemFileHandle,
  ): Promise<void> => {
    setIsBusy(true);

    try {
      // Reading the file here confirms that the selected or dropped source is
      // accessible before it becomes the current document.
      await file.arrayBuffer();

      if (fileHandle) {
        setOpenedFile({
          name: file.name,
          size: file.size,
          handle: fileHandle,
        });
      } else {
        setOpenedFile({ name: file.name, size: file.size });
      }
      setActiveView("home");
      setStatus(`「${file.name}」を開きました。`);
    } catch (error) {
      console.error("ファイルを開けませんでした。", error);
      setStatus("ファイルを開けませんでした。読み取り権限を確認してください。");
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpen = async (): Promise<void> => {
    const filePickerWindow = window as FilePickerWindow;

    if (!filePickerWindow.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }

    setIsBusy(true);

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
      setIsBusy(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const [file] = event.target.files ?? [];
    event.target.value = "";

    if (file) {
      void openFile(file);
    }
  };

  const handleCreate = async (): Promise<void> => {
    const filePickerWindow = window as FilePickerWindow;

    if (!filePickerWindow.showSaveFilePicker) {
      setStatus("この環境では保存先を選択できません。Chromeでお試しください。");
      return;
    }

    setIsBusy(true);

    try {
      const fileHandle = await filePickerWindow.showSaveFilePicker({
        suggestedName: "新しい予算データ.json",
        types: [
          {
            description: "Triadichrome予算データ",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();

      try {
        await writable.write(initialDocument);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => undefined);
        throw error;
      }

      setOpenedFile({
        name: fileHandle.name,
        size: new TextEncoder().encode(initialDocument).byteLength,
        handle: fileHandle,
      });
      setActiveView("home");
      setStatus(`「${fileHandle.name}」を新規作成しました。`);
    } catch (error) {
      if (!isPickerCancellation(error)) {
        console.error("新規データを作成できませんでした。", error);
        setStatus("新規データを作成できませんでした。保存先を確認してください。");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>): void => {
    if (hasFileDrag(event)) {
      event.preventDefault();
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

    const fileItem = Array.from(event.dataTransfer.items).find(
      (item) => item.kind === "file",
    );

    if (fileItem) {
      void getDroppedFile(fileItem).then((droppedFile) => {
        if (!droppedFile) {
          setStatus("ファイルを読み取れませんでした。別のファイルをお試しください。");
          return;
        }

        if (droppedFile.handle) {
          void openFile(droppedFile.file, droppedFile.handle);
        } else {
          void openFile(droppedFile.file);
        }
      });
      return;
    }

    const [file] = Array.from(event.dataTransfer.files);
    if (file) {
      void openFile(file);
    } else {
      setStatus("ファイルをドロップしてください。");
    }
  };

  if (openedFile) {
    return (
      <WorkspaceLayout fileName={openedFile.name}>
        {activeView === "home" ? (
          <HomeView onNavigate={setActiveView} />
        ) : (
          <WorkspacePlaceholder
            section={activeView}
            onHome={() => setActiveView("home")}
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
          accept=".json,.csv,.xlsx"
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
