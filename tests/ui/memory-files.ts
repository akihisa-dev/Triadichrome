export type FileScenario = "normal" | "cancel" | "invalid" | "save-failure" | "write-permission" | "permission-denied" | "file-conflict";

export type MemoryFileOptions = {
  bytes: number[] | Uint8Array;
  scenario: FileScenario;
  name?: string;
  externalBytes?: number[] | Uint8Array;
};

// Only the browser's file picker / writer boundary is replaced. The application
// still creates, reads and validates real SQLite bytes through its own code.
// Keep this function self-contained so Playwright can install it in either page.
export function installMemoryFiles(
  options: MemoryFileOptions,
  target: Window & typeof globalThis = window,
) {
  let name = options.name ?? "画面テスト.triadic";
  let contents: BlobPart = new Uint8Array(options.bytes);
  let writable = options.scenario !== "write-permission" && options.scenario !== "permission-denied";
  let reads = 0;
  const originalName = name;
  const getFile = () => new target.File([contents], name);
  const checkCancellation = () => {
    if (options.scenario === "cancel") {
      throw new target.DOMException("選択をキャンセルしました。", "AbortError");
    }
  };
  const createHandle = (fileName: string) => {
    const separate = options.scenario === "file-conflict" && fileName !== originalName;
    let separateContents: BlobPart = new Uint8Array();
    return ({
    isSameEntry: async (other: { name: string }) => other.name === fileName,
    name: fileName,
    queryPermission: async ({ mode }: { mode: string }) => mode === "read" || writable ? "granted" : "prompt",
    requestPermission: async ({ mode }: { mode: string }) => {
      if (mode !== "readwrite") throw new Error("読み書きの許可が必要です。");
      writable = options.scenario !== "permission-denied";
      return writable ? "granted" : "denied";
    },
    getFile: async () => {
      if (separate) return new target.File([separateContents], fileName);
      if (options.scenario === "file-conflict" && ++reads > 1 && options.externalBytes) contents = new Uint8Array(options.externalBytes);
      return options.scenario === "invalid" ? new target.File(["not a SQLite database"], name) : getFile();
    },
    createWritable: async () => {
      if (!writable) throw new target.DOMException("書き込みが許可されていません。", "NotAllowedError");
      let pending: BlobPart | undefined;
      return {
        async write(data: BlobPart) {
          if (options.scenario === "save-failure") {
            throw new target.DOMException("テスト用の保存失敗です。", "NotAllowedError");
          }
          pending = data;
        },
        async close() {
          if (pending === undefined) throw new Error("書き込み内容がありません。");
          if (separate) separateContents = pending;
          else { contents = pending; name = fileName; }
        },
        async abort() { pending = undefined; },
      };
    },
  });
  };

  Object.defineProperties(target, {
    showOpenFilePicker: {
      configurable: true,
      value: async () => {
        checkCancellation();
        return [createHandle(name)];
      },
    },
    showSaveFilePicker: {
      configurable: true,
      value: async ({ suggestedName }: { suggestedName: string }) => {
        checkCancellation();
        return createHandle(suggestedName);
      },
    },
  });

  return { getFile };
}
