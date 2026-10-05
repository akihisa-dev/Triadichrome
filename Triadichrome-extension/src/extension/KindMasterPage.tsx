import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn } from "../core/tableView";
import { useCallback, useState } from "react";
import { type Kind, type KindChange } from "../core/kindMaster";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

type Props = AutoSaveProps & {
  kinds: Kind[];
  isSaving: boolean;
  onChange: (change: KindChange) => Promise<void>;
  onBack: () => void;
};

export function KindMasterPage({ kinds, isSaving, onChange, onBack, onPendingChange, onPrepareSave }: Props) {
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Kind | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const autoSave = useAutoSave<Extract<KindChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const [view, setView] = useState(emptyTableView);
  const columns: TableColumn<Kind>[] = [{ id: "kindName", label: "種別", value: item => item.kindName }];
  const visible = applyTableView(kinds, columns, view);
  const save = async (change: KindChange) => {
    dismissNotice();
    try {
      await onChange(change);
      if (change.type === "add") { setName(""); }
      setDeleting(null);
      setNotice({ message: change.type === "delete" ? "種別を削除しました。" : "種別を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "保存できませんでした。", error: !cancelled });
    }
  };
  return <main className="master-page" aria-labelledby="kind-master-title" aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="kind-master-title">種別マスタ</h1>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", kindName: name });
    }}>
      <div className="account-master-fields">
        <div className="initiative-field">
          <label htmlFor="kind-name">種別</label>
          <input id="kind-name" autoComplete="off" value={name} disabled={isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={isSaving || draft !== null || !name.trim()}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title="種別を削除" message={deleting ? `「${deleting.kindName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <button type="button" className="text-button" disabled={isSaving || draft !== null} onClick={() => setView(emptyTableView())}>クリア</button>
    <div className="account-master-list" role="region" aria-label="種別一覧" tabIndex={0}>
      <table className="account-master-table kind-master-table" aria-label="種別一覧">
        <thead><tr><th scope="col"><TableHeader column={columns[0]!} rows={kinds} view={view} onChange={setView} disabled={isSaving || draft !== null} /></th><th scope="col">操作</th></tr></thead>
        <tbody>
          {kinds.length === 0 && <tr><td colSpan={2} className="page-description">種別はまだ登録されていません。</td></tr>}
          {visible.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              <th scope="row" className="account-master-name">{editing ? <input autoFocus aria-label={`${item.kindName}の種別`} value={editing.kindName} onChange={event => controller.change({ ...editing, kindName: event.target.value })} /> : item.kindName}</th>
              <td><div className="form-actions">{editing
                ? <button className="text-button" type="button" disabled={autoSave.pending} onClick={() => controller.end()}>完了</button>
                : <><button className="text-button" type="button" aria-label={`${item.kindName}を編集`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); controller.begin({ type: "update", ...item }); }}>編集</button>
                  <button className="text-button" type="button" aria-label={`${item.kindName}を削除`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); setDeleting(item); }}>削除</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </main>;
}
