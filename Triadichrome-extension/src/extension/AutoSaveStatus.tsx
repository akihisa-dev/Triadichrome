import { type AutoSave, type AutoSaveState } from "../core/autoSave";
import { StatusNotice } from "./StatusNotice";
import "./AutoSaveStatus.css";

export function AutoSaveStatus<T>({ state, controller, onPrepareSave }: {
  state: AutoSaveState<T>; controller: AutoSave<T>; onPrepareSave: () => Promise<void>;
}) {
  return <StatusNotice
    message={state.error ? `自動保存できませんでした。${state.error} 入力内容は残っています。` : ""}
    error
    actions={<div className="auto-save-recovery">
      <button className="text-button" type="button" disabled={!state.error || state.saving} onClick={() => {
        void onPrepareSave().then(() => controller.flush()).catch(error => controller.fail(error));
      }}>保存を再試行</button>
      <button className="text-button" type="button" disabled={!state.pending || state.saving} onClick={() => controller.discard()}>入力を取り消す</button>
    </div>}
  />;
}
