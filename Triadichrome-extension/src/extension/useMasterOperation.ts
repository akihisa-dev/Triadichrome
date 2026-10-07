import { useCallback, useState } from "react";
/** Manual operations report outcomes; automatic saves must propagate errors. */
export function useMasterOperation<T>(options: {
  onChange: (change: T) => Promise<void>;
  successMessage: (change: T) => string;
  onSuccess?: (change: T) => void;
  onFailure?: (change: T) => void;
  cancelledMessage?: (change: T) => string;
}) {
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismiss = useCallback(() => setNotice({ message: "", error: false }), []);
  const save = async (change: T): Promise<boolean> => {
    dismiss();
    try {
      await options.onChange(change);
      options.onSuccess?.(change);
      setNotice({ message: options.successMessage(change), error: false });
      return true;
    } catch (failure) {
      options.onFailure?.(change);
      const cancelled = failure instanceof DOMException && failure.name === "AbortError";
      setNotice({ message: cancelled ? options.cancelledMessage?.(change) ?? "保存をキャンセルしました。入力内容は残っています。"
        : failure instanceof Error ? failure.message : "保存できませんでした。", error: !cancelled });
      return false;
    }
  };
  return { notice, dismiss, save };
}
