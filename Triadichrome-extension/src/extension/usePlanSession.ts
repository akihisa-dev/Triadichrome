import { useEffect, useState, useSyncExternalStore } from "react";
import { HISTORY_INTERVAL_MS } from "../core/storage/dataHistory";
import { PlanSession } from "./PlanSession";
export function usePlanSession(destination: () => Promise<FileSystemFileHandle>, closing: boolean) {
  const [session] = useState(() => new PlanSession());
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    if (!snapshot.contents || !snapshot.history.dirtySince || snapshot.historyError || closing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const record = () => {
      if (cancelled) return;
      if (session.getSnapshot().busy) { timer = setTimeout(record, 250); return; }
      void session.checkpoint(false, destination).catch(() => {});
    };
    timer = setTimeout(record, Math.max(0, Date.parse(snapshot.history.dirtySince) + HISTORY_INTERVAL_MS - Date.now()));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session, snapshot.contents !== null, snapshot.history.dirtySince, snapshot.historyError, destination, closing]);
  return { session, snapshot };
}
