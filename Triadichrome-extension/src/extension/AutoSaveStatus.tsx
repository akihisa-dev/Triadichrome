import { useEffect, useState } from "react";
import { type AutoSave, type AutoSaveState } from "../core/autoSave";
import { StatusNotice } from "./StatusNotice";
import { FadeSwap } from "./FadeSwap";
import "./AutoSaveStatus.css";

export function AutoSaveStatus<T>({ state, controller, onPrepareSave }: {
  state: AutoSaveState<T>; controller: AutoSave<T>; onPrepareSave: () => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [state.error]);
  const label = state.error ? "未保存" : state.saving ? "保存中…" : state.pending ? "保存待ち…" : "保存済み";
  return <>
    <div className="auto-save-controls">
      <span className="auto-save-state" role="status"><FadeSwap value={label}>{text => text}</FadeSwap></span>
      <button className="text-button" type="button" disabled={!state.error || state.saving} onClick={() => {
        void onPrepareSave().then(() => controller.flush()).catch(error => controller.fail(error));
      }}>保存を再試行</button>
      <button className="text-button" type="button" disabled={!state.pending || state.saving} onClick={() => controller.discard()}>未保存の変更を戻す</button>
    </div>
    <StatusNotice message={state.error && !dismissed ? `自動保存できませんでした。${state.error} 入力内容は残っています。` : ""} error onDismiss={() => setDismissed(true)} />
  </>;
}
