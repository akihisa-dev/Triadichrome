import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FadeSwap } from "./FadeSwap";

type StatusNoticeProps = {
  message: string;
  error?: boolean;
  onDismiss?: () => void;
  actions?: ReactNode;
};

function noticeLayer() {
  let layer = document.getElementById("status-notice-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "status-notice-layer";
    layer.className = "status-notice-layer";
    document.body.append(layer);
  }
  return layer;
}

export function StatusNotice({ message, error = false, onDismiss, actions }: StatusNoticeProps) {
  const [layer] = useState(noticeLayer);
  const notice = useMemo(() => ({ message, error }), [message, error]);
  useEffect(() => {
    if (!message || error || !onDismiss) return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error, onDismiss]);
  // Escape transformed page containers so notifications never affect page layout.
  return createPortal(<div className="status-notice-slot">
    <FadeSwap value={notice} className="motion-text">{value => value.message ? <div className="status-notice">
      <div>
        <p role={value.error ? "alert" : "status"}>{value.message}</p>
        {actions}
      </div>
      {onDismiss && <button className="text-button" type="button" aria-label="通知を閉じる" onClick={onDismiss}>×</button>}
    </div> : null}</FadeSwap>
  </div>, layer);
}
