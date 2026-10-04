import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AutoSave } from "../core/autoSave";

export type AutoSaveProps = {
  onPendingChange: (pending: boolean) => void;
  onPrepareSave: () => Promise<void>;
};

export function useAutoSave<T>(save: (draft: T) => Promise<void>, onPendingChange: (pending: boolean) => void) {
  const operation = useRef(save);
  useLayoutEffect(() => { operation.current = save; });
  const [controller] = useState(() => new AutoSave<T>(draft => operation.current(draft)));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useLayoutEffect(() => { onPendingChange(state.pending); }, [onPendingChange, state.pending]);
  useEffect(() => () => { controller.cancelTimer(); onPendingChange(false); }, [controller, onPendingChange]);
  useEffect(() => {
    if (!state.pending) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [state.pending]);
  return { ...state, controller };
}
