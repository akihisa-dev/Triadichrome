import { useRef, useState } from "react";
/** Prevents duplicate UI actions; saved data is owned by PlanSession. */
export function useMutation(assertAllowed: () => void = () => {}) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async <T,>(operation: () => Promise<T>): Promise<T> => {
    assertAllowed();
    if (running.current) throw new Error("保存が終わるまでお待ちください。");
    running.current = true; setBusy(true);
    try { return await operation(); }
    finally { running.current = false; setBusy(false); }
  };
  return { run, busy, running };
}
