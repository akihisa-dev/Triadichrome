import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FadeSwap } from "./FadeSwap";

type StatusNoticeProps = {
  message: string;
  error?: boolean;
  onDismiss?: () => void;
  actions?: ReactNode;
};

export function StatusNotice({ message, error = false, onDismiss, actions }: StatusNoticeProps) {
  const notice = useMemo(() => ({ message, error }), [message, error]);
  useEffect(() => {
    if (!message || error || !onDismiss) return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error, onDismiss]);
  // Escape transformed page containers so notifications never affect page layout.
  return createPortal(<div className="status-notice-layer">
    <FadeSwap value={notice} className="motion-text">{value => value.message ? <div className="status-notice">
      <div>
        <p role={value.error ? "alert" : "status"}>{value.message}</p>
        {actions}
      </div>
      {onDismiss && <button className="text-button" type="button" aria-label="通知を閉じる" onClick={onDismiss}>×</button>}
    </div> : null}</FadeSwap>
  </div>, document.body);
}
