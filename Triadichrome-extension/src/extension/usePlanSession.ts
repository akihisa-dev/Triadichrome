import { useEffect, useState, useSyncExternalStore } from "react";
import { HISTORY_INTERVAL_MS } from "../core/storage/dataHistory";
import { PlanSession } from "./PlanSession";
export function usePlanSession(destination: () => Promise<FileSystemFileHandle>, closing: boolean) {
  const [session] = useState(() => new PlanSession());
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    if (!snapshot.contents || !snapshot.history.dirtySince || snapshot.historyError || closing) return;
    return scheduleHistoryCheckpoint(session, destination);
  }, [session, snapshot.contents !== null, snapshot.history.dirtySince, snapshot.historyError, destination, closing]);
  return { session, snapshot };
}

// Re-evaluate wall-clock deadlines after an early, successful checkpoint.
export function scheduleHistoryCheckpoint(session: Pick<PlanSession, "getSnapshot" | "checkpoint">,
  destination: () => Promise<FileSystemFileHandle>, clock = {
    now: () => Date.now(),
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  }) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const current = session.getSnapshot();
    if (cancelled || !current.contents || !current.history.dirtySince || current.historyError) return;
    const delay = Date.parse(current.history.dirtySince) + HISTORY_INTERVAL_MS - clock.now();
    timer = clock.setTimeout(record, Math.min(2_147_483_647, Math.max(0, delay)));
  };
  const record = () => {
    if (cancelled) return;
    const current = session.getSnapshot();
    if (!current.contents || !current.history.dirtySince || current.historyError) return;
    if (current.busy) { timer = clock.setTimeout(record, 250); return; }
    void session.checkpoint(false, destination).then(schedule, () => {});
  };
  schedule();
  return () => { cancelled = true; clock.clearTimeout(timer); };
}
