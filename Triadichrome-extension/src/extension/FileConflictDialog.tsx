import { useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { choosePlanDestination } from "./filePicker";
import { registerFileConflictRecovery } from "./fileConflict";

/** Keep the original save pending so its draft and caller stay intact throughout recovery. */
export function FileConflictDialog() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resolve = useRef<((handle: FileSystemFileHandle | null) => void) | null>(null);
  useEffect(() => {
    const unregister = registerFileConflictRecovery(fileName => new Promise(done => {
      resolve.current = done; setError(""); setName(fileName);
    }));
    return () => { unregister(); resolve.current?.(null); resolve.current = null; };
  }, []);
  const finish = (handle: FileSystemFileHandle | null) => {
    resolve.current?.(handle); resolve.current = null; setName(null);
  };
  return <ConfirmationDialog open={name !== null} title="入力を保持しています"
    message={error || `「${name ?? ""}」の保存内容が更新され、今回の入力と安全にまとめられませんでした。入力した計画全体を別のファイルに保存して、そのまま編集を続けられます。元のファイルの更新は残ります。`}
    confirmLabel="別のファイルに保存して続ける" busy={busy} onCancel={() => finish(null)} onConfirm={() => {
      if (busy || !name) return;
      setBusy(true); setError("");
      // Start the system picker directly in the click to retain user activation.
      let picked: Promise<FileSystemFileHandle>;
      try { picked = choosePlanDestination(name.replace(/\.triadic$/i, "-入力を保持.triadic")); }
      catch (failure) { setError(failure instanceof Error ? failure.message : "保存先を選べませんでした。入力は保持しています。"); setBusy(false); return; }
      void picked.then(handle => finish(handle)).catch(failure => {
        if (!(failure instanceof DOMException && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "保存先を選べませんでした。入力は保持しています。");
      }).finally(() => setBusy(false));
    }} />;
}
