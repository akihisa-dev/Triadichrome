import { useMasterOperation } from "./useMasterOperation";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useState } from "react";

import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

export type NamedMasterRow = { id: number; name: string; code: string };
export type NamedMasterChange = { type: "add"; name: string; code: string } | ({ type: "update" } & NamedMasterRow) | { type: "delete"; id: number };
type Props = AutoSaveProps & {
  rows: NamedMasterRow[]; usedIds?: Set<number>; isSaving: boolean;
  subject: string; slug: string; coded?: boolean;
  onChange: (change: NamedMasterChange) => Promise<void>; onBack: () => void;
};
/** Common lifecycle for naming masters; domain adapters own their constraints. */
export function NamedMasterPage({ rows, usedIds = new Set(), isSaving, onChange, onBack, onPendingChange, onPrepareSave, subject, slug, coded = false }: Props) {
  const [code, setCode] = useState("");
  const readOnly = useHistoryReadOnly();
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<NamedMasterRow | null>(null);
  const autoSave = useAutoSave<Extract<NamedMasterChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const { notice, dismiss: dismissNotice, save } = useMasterOperation<NamedMasterChange>({
    onChange,
    onSuccess: change => { if (change.type === "add") { setCode(""); setName(""); } setDeleting(null); },
    successMessage: change => change.type === "delete" ? `${subject}を削除しました。` : `${subject}を登録しました。`,
  });
  return <main className="master-page" aria-labelledby={`${slug}-master-title`} aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id={`${slug}-master-title`}>{subject}マスタ</h1>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", code, name });
    }}>
      <div className="account-master-fields">
        {coded && <div className="initiative-field account-code-field">
          <label htmlFor={`${slug}-code`}>{subject}コード</label>
          <input id={`${slug}-code`} inputMode="numeric" autoComplete="off" value={code} disabled={readOnly || isSaving || draft !== null} onChange={event => setCode(event.target.value)} />
          <span className="field-hint">半角数字</span>
        </div>}
        <div className="initiative-field">
          <label htmlFor={`${slug}-name`}>{subject}名</label>
          <input id={`${slug}-name`} autoComplete="off" value={name} disabled={readOnly || isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={readOnly || isSaving || draft !== null || (coded && !code.trim()) || !name.trim()}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title={`${subject}を削除`} message={deleting ? `「${coded ? `${deleting.code} ` : ""}${deleting.name}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="account-master-list" role="region" aria-label={`${subject}一覧`} tabIndex={0}>
      <table className={`account-master-table ${slug}-master-table`} aria-label={`${subject}一覧`}>
        <thead><tr>{coded && <th scope="col">{subject}コード</th>}<th scope="col">{subject}名</th><th scope="col">操作</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={coded ? 3 : 2} className="page-description">{subject}はまだ登録されていません。</td></tr>}
          {rows.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              {coded && <td className="account-code">{editing ? <input autoFocus aria-label={`${item.name}の${subject}コード`} inputMode="numeric" value={editing.code} onChange={event => controller.change({ ...editing, code: event.target.value })} /> : item.code}</td>}
              <th scope="row" className="account-master-name">{editing ? <input autoFocus={!coded} aria-label={`${item.name}の${subject}名`} value={editing.name} onChange={event => controller.change({ ...editing, name: event.target.value })} /> : item.name}</th>
              <td><div className="form-actions">{editing
                ? <button className="text-button" type="button" disabled={readOnly || autoSave.pending} onClick={() => controller.end()}>完了</button>
                : <><button className="text-button" type="button" aria-label={`${item.name}を編集`} disabled={readOnly || isSaving || draft !== null} onClick={() => { dismissNotice(); controller.begin({ type: "update", ...item }); }}>編集</button>
                  <button className="text-button" type="button" aria-label={`${item.name}を削除`} title={usedIds.has(item.id) ? "施策で使用中" : undefined} disabled={readOnly || isSaving || draft !== null || usedIds.has(item.id)} onClick={() => { dismissNotice(); setDeleting(item); }}>削除</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </main>;
}
