export type FileScenario = "normal" | "cancel" | "invalid" | "save-failure";

export type MemoryFileOptions = {
  bytes: number[];
  scenario: FileScenario;
  name?: string;
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
  const getFile = () => new target.File([contents], name);
  const checkCancellation = () => {
    if (options.scenario === "cancel") {
      throw new target.DOMException("選択をキャンセルしました。", "AbortError");
    }
  };

  Object.defineProperties(target, {
    showOpenFilePicker: {
      configurable: true,
      value: async () => {
        checkCancellation();
        return [{ getFile: async () => options.scenario === "invalid"
          ? new target.File(["not a SQLite database"], name)
          : getFile() }];
      },
    },
    showSaveFilePicker: {
      configurable: true,
      value: async ({ suggestedName }: { suggestedName: string }) => {
        checkCancellation();
        return {
          name: suggestedName,
          getFile: async () => getFile(),
          createWritable: async () => {
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
                contents = pending;
                name = suggestedName;
              },
              async abort() { pending = undefined; },
            };
          },
        };
      },
    },
  });

  return { getFile };
}
