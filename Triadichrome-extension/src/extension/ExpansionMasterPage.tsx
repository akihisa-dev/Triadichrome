import { useCallback, useState } from "react";
import { type Expansion, type ExpansionChange } from "../core/expansionMaster";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

type Props = AutoSaveProps & {
  expansions: Expansion[];
  usedExpansionIds: Set<number>;
  isSaving: boolean;
  onChange: (change: ExpansionChange) => Promise<void>;
  onBack: () => void;
};

export function ExpansionMasterPage({ expansions, usedExpansionIds, isSaving, onChange, onBack, onPendingChange, onPrepareSave }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Expansion | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const autoSave = useAutoSave<Extract<ExpansionChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const save = async (change: ExpansionChange) => {
    dismissNotice();
    try {
      await onChange(change);
      if (change.type === "add") { setCode(""); setName(""); }
      setDeleting(null);
      setNotice({ message: change.type === "delete" ? "展開を削除しました。" : "展開を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "保存できませんでした。", error: !cancelled });
    }
  };
  return <main className="master-page" aria-labelledby="expansion-master-title" aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="expansion-master-title">展開マスタ</h1>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", expansionCode: code, expansionName: name });
    }}>
      <div className="account-master-fields">
        <div className="initiative-field account-code-field">
          <label htmlFor="expansion-code">展開コード</label>
          <input id="expansion-code" inputMode="numeric" autoComplete="off" value={code} disabled={isSaving || draft !== null} onChange={event => setCode(event.target.value)} />
          <span className="field-hint">半角数字</span>
        </div>
        <div className="initiative-field">
          <label htmlFor="expansion-name">展開名</label>
          <input id="expansion-name" autoComplete="off" value={name} disabled={isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={isSaving || draft !== null || !code.trim() || !name.trim()}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title="展開を削除" message={deleting ? `「${deleting.expansionCode} ${deleting.expansionName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="account-master-list" role="region" aria-label="展開一覧" tabIndex={0}>
      <table className="account-master-table expansion-master-table" aria-label="展開一覧">
        <thead><tr><th scope="col">展開コード</th><th scope="col">展開名</th><th scope="col">操作</th></tr></thead>
        <tbody>
          {expansions.length === 0 && <tr><td colSpan={3} className="page-description">展開はまだ登録されていません。</td></tr>}
          {expansions.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              <td className="account-code">{editing ? <input autoFocus aria-label={`${item.expansionName}の展開コード`} inputMode="numeric" value={editing.expansionCode} onChange={event => controller.change({ ...editing, expansionCode: event.target.value })} /> : item.expansionCode}</td>
              <th scope="row" className="account-master-name">{editing ? <input aria-label={`${item.expansionName}の展開名`} value={editing.expansionName} onChange={event => controller.change({ ...editing, expansionName: event.target.value })} /> : item.expansionName}</th>
              <td><div className="form-actions">{editing
                ? <button className="text-button" type="button" disabled={autoSave.pending} onClick={() => controller.end()}>完了</button>
                : <><button className="text-button" type="button" aria-label={`${item.expansionName}を編集`} disabled={isSaving || draft !== null} onClick={() => { dismissNotice(); controller.begin({ type: "update", ...item }); }}>編集</button>
                  <button className="text-button" type="button" aria-label={`${item.expansionName}を削除`} title={usedExpansionIds.has(item.id) ? "施策で使用中" : undefined} disabled={isSaving || draft !== null || usedExpansionIds.has(item.id)} onClick={() => { dismissNotice(); setDeleting(item); }}>削除</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </main>;
}
