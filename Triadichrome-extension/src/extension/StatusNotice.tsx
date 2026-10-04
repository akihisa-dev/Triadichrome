import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FadeSwap } from "./FadeSwap";

type StatusNoticeProps = {
  message: string;
  error?: boolean;
  onDismiss: () => void;
};

export function StatusNotice({ message, error = false, onDismiss }: StatusNoticeProps) {
  const notice = useMemo(() => ({ message, error }), [message, error]);
  useEffect(() => {
    if (!message || error) return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error, onDismiss]);
  // Escape transformed page containers so notifications never affect page layout.
  return createPortal(<div className="status-notice-layer">
    <FadeSwap value={notice} className="motion-text">{value => value.message ? <div className="status-notice">
      <p role={value.error ? "alert" : "status"}>{value.message}</p>
      <button className="text-button" type="button" aria-label="通知を閉じる" onClick={onDismiss}>×</button>
    </div> : null}</FadeSwap>
  </div>, document.body);
}
