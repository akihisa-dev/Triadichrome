import { TableHeader } from "./TableHeader";
import { applyTableView, emptyTableView, type TableColumn } from "../core/tableView";
import { useCallback, useState } from "react";
import { type Industry, type IndustryChange } from "../core/industryMaster";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

type Props = AutoSaveProps & {
  industries: Industry[];
  isSaving: boolean;
  onChange: (change: IndustryChange) => Promise<void>;
  onBack: () => void;
};

export function IndustryMasterPage({ industries, isSaving, onChange, onBack, onPendingChange, onPrepareSave }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Industry | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const autoSave = useAutoSave<Extract<IndustryChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const [view, setView] = useState(emptyTableView);
  const columns: TableColumn<Industry>[] = [{ id: "industryCode", label: "業種コード", value: item => item.industryCode }, { id: "industryName", label: "業種名", value: item => item.industryName }];
  const visible = applyTableView(industries, columns, view);
  const save = async (change: IndustryChange) => {
    dismissNotice();
    try {
      await onChange(change);
      if (change.type === "add") { setCode(""); setName(""); }
      setDeleting(null);
      setNotice({ message: change.type === "delete" ? "業種を削除しました。" : "業種を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "保存できませんでした。", error: !cancelled });
    }
  };
  return <main className="master-page" aria-labelledby="industry-master-title" aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="industry-master-title">業種マスタ</h1>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", industryCode: code, industryName: name });
    }}>
      <div className="account-master-fields">
        <div className="initiative-field account-code-field">
          <label htmlFor="industry-code">業種コード</label>
          <input id="industry-code" inputMode="numeric" autoComplete="off" value={code} disabled={isSaving || draft !== null} onChange={event => setCode(event.target.value)} />
          <span className="field-hint">半角数字</span>
        </div>
        <div className="initiative-field">
          <label htmlFor="industry-name">業種名</label>
          <input id="industry-name" autoComplete="off" value={name} disabled={isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={isSaving || draft !== null || !code.trim() || !name.trim()}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title="業種を削除" message={deleting ? `「${deleting.industryCode} ${deleting.industryName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <button type="button" className="text-button" disabled={isSaving || draft !== null} onClick={() => setView(emptyTableView())}>クリア</button>
    <div className="account-master-list" role="region" aria-label="業種一覧" tabIndex={0}>
      <table className="account-master-table industry-master-table" aria-label="業種一覧">
        <thead><tr><th scope="col"><TableHeader column={columns[0]!} rows={industries} view={view} onChange={setView} disabled={isSaving || draft !== null} /></th><th scope="col"><TableHeader column={columns[1]!} rows={industries} view={view} onChange={setView} disabled={isSaving || draft !== null} /></th><th scope="col">操作</th></tr></thead>
        <tbody>
          {industries.length === 0 && <tr><td colSpan={3} className="page-description">業種はまだ登録されていません。</td></tr>}
          {visible.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              <td className="account-code">{editing ? <input autoFocus aria-label={`${item.industryName}の業種コード`} inputMode="numeric" value={editing.industryCode} onChange={event => controller.change({ ...editing, industryCode: event.target.value })} /> : item.industryCode}</td>
              <th scope="row" className="account-master-name">{editing ? <input aria-label={`${item.industryName}の業種名`} value={editing.industryName} onChange={event => controller.change({ ...editing, industryName: event.target.value })} /> : item.industryName}</th>
              <td><div className="form-actions">{editing
                ? <button className="text-button" type="button" disabled={autoSave.pending} onClick={() => controller.end()}>完了</button>
                : <><button className="text-button" type="button" aria-label={`${item.industryName}を編集`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); controller.begin({ type: "update", ...item }); }}>編集</button>
                  <button className="text-button" type="button" aria-label={`${item.industryName}を削除`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); setDeleting(item); }}>削除</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </main>;
}
