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

export function ExtensionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null);
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
        {openedFile ? (
          <p className="entry-file-info">
            開いているファイル: <strong>{openedFile.name}</strong>
          </p>
        ) : null}
      </div>
    </main>
  );
}
