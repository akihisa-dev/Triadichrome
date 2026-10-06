import { useCallback, useState } from "react";
import { type Department, type DepartmentChange } from "../core/departmentMaster";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

type Props = AutoSaveProps & {
  departments: Department[];
  isSaving: boolean;
  onChange: (change: DepartmentChange) => Promise<void>;
  onBack: () => void;
};

export function DepartmentMasterPage({ departments, isSaving, onChange, onBack, onPendingChange, onPrepareSave }: Props) {
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const autoSave = useAutoSave<Extract<DepartmentChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const save = async (change: DepartmentChange) => {
    dismissNotice();
    try {
      await onChange(change);
      if (change.type === "add") { setName(""); }
      setDeleting(null);
      setNotice({ message: change.type === "delete" ? "部署を削除しました。" : "部署を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "保存できませんでした。", error: !cancelled });
    }
  };
  return <main className="master-page" aria-labelledby="department-master-title" aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="department-master-title">部署マスタ</h1>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", departmentName: name });
    }}>
      <div className="account-master-fields">
        <div className="initiative-field">
          <label htmlFor="department-name">部署名</label>
          <input id="department-name" autoComplete="off" value={name} disabled={isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={isSaving || draft !== null || !name.trim()}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title="部署を削除" message={deleting ? `「${deleting.departmentName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="account-master-list" role="region" aria-label="部署一覧" tabIndex={0}>
      <table className="account-master-table department-master-table" aria-label="部署一覧">
        <thead><tr><th scope="col">部署名</th><th scope="col">操作</th></tr></thead>
        <tbody>
          {departments.length === 0 && <tr><td colSpan={2} className="page-description">部署はまだ登録されていません。</td></tr>}
          {departments.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              <th scope="row" className="account-master-name">{editing ? <input autoFocus aria-label={`${item.departmentName}の部署名`} value={editing.departmentName} onChange={event => controller.change({ ...editing, departmentName: event.target.value })} /> : item.departmentName}</th>
              <td><div className="form-actions">{editing
                ? <button className="text-button" type="button" disabled={autoSave.pending} onClick={() => controller.end()}>完了</button>
                : <><button className="text-button" type="button" aria-label={`${item.departmentName}を編集`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); controller.begin({ type: "update", ...item }); }}>編集</button>
                  <button className="text-button" type="button" aria-label={`${item.departmentName}を削除`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); setDeleting(item); }}>削除</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </main>;
}
