export class FileConflictError extends Error {
  constructor() {
    super("保存先のファイルが更新されたため、保存を止めました。入力はこの画面に保持しています。");
    this.name = "FileConflictError";
  }
}
type Recovery = (name: string) => Promise<FileSystemFileHandle | null>;
let recovery: Recovery | undefined;
export function registerFileConflictRecovery(handler: Recovery) {
  recovery = handler;
  return () => { if (recovery === handler) recovery = undefined; };
}
export async function recoverFileConflict(handle: FileSystemFileHandle) {
  if (!recovery) throw new FileConflictError();
  const destination = await recovery(handle.name);
  if (!destination) throw new FileConflictError();
  if (!destination.name.toLowerCase().endsWith(".triadic")) throw new Error("拡張子は.triadicにしてください。入力は保持しています。");
  if (!handle.isSameEntry || await handle.isSameEntry(destination)) throw new Error("更新された元のファイルを保護するため、別のファイル名を選んでください。入力は保持しています。");
  return destination;
}
