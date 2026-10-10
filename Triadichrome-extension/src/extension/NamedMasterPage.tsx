import { useMasterOperation } from "./useMasterOperation";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useState } from "react";

import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

export type NamedMasterRow = { id: number; name: string; code: string; industryIds?: number[] };
export type NamedMasterChange = { type: "add"; name: string; code: string; industryIds?: number[] } | ({ type: "update" } & NamedMasterRow) | { type: "delete"; id: number };
type Props = AutoSaveProps & {
  rows: NamedMasterRow[]; usedIds?: Set<number>; isSaving: boolean;
  subject: string; slug: string; coded?: boolean;
  industryOptions?: { id: number; name: string }[];
  onChange: (change: NamedMasterChange) => Promise<void>; onBack: () => void;
};
/** Common lifecycle for naming masters; domain adapters own their constraints. */
export function NamedMasterPage({ rows, usedIds = new Set(), isSaving, onChange, onBack, onPendingChange, onPrepareSave, subject, slug, coded = false, industryOptions }: Props) {
  const [code, setCode] = useState("");
  const readOnly = useHistoryReadOnly();
  const [name, setName] = useState("");
  const [industryIds, setIndustryIds] = useState<number[]>([]);
  const industryChoices = (selected: number[], change: (ids: number[]) => void, disabled: boolean, label: string) => <fieldset className="department-industry-choices"><legend>{label}</legend>{industryOptions?.map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={disabled} onChange={event => change(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.name}</label>)}</fieldset>;
  const [deleting, setDeleting] = useState<NamedMasterRow | null>(null);
  const autoSave = useAutoSave<Extract<NamedMasterChange, { type: "update" }>>(onChange, onPendingChange);
  const { draft, controller } = autoSave;
  const { notice, dismiss: dismissNotice, save } = useMasterOperation<NamedMasterChange>({
    onChange,
    onSuccess: change => { if (change.type === "add") { setCode(""); setName(""); setIndustryIds([]); } setDeleting(null); },
    successMessage: change => change.type === "delete" ? `${subject}を削除しました。` : `${subject}を登録しました。`,
  });
  return <main className="master-page account-master-page master-data-page named-master-page" aria-labelledby={`${slug}-master-title`} aria-busy={isSaving}
    onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <div className="account-master-heading"><button className="text-button master-back" type="button" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
    <h1 id={`${slug}-master-title`}>{subject}マスタ</h1><span className="master-count">{rows.length}件</span></div>
    <form className="account-master-form" aria-label={`${subject}の新規登録`} onSubmit={event => {
      event.preventDefault();
      if (!isSaving && !draft) void save({ type: "add", code, name, ...(industryOptions ? { industryIds } : {}) });
    }}>
      <span className="master-form-label">新規登録</span><div className="account-master-fields">
        {coded && <div className="initiative-field account-code-field">
          <label htmlFor={`${slug}-code`}>{subject}コード</label>
          <input id={`${slug}-code`} inputMode="numeric" autoComplete="off" value={code} disabled={readOnly || isSaving || draft !== null} onChange={event => setCode(event.target.value)} />
          <span className="field-hint">半角数字</span>
        </div>}
        <div className="initiative-field">
          <label htmlFor={`${slug}-name`}>{subject}名</label>
          <input id={`${slug}-name`} autoComplete="off" value={name} disabled={readOnly || isSaving || draft !== null} onChange={event => setName(event.target.value)} />
        </div>
        {industryOptions && industryChoices(industryIds, setIndustryIds, readOnly || isSaving || draft !== null, "業種名")}
      </div>
      <button className="primary-button" type="submit" disabled={readOnly || isSaving || draft !== null || (coded && !code.trim()) || !name.trim() || (industryOptions !== undefined && !industryIds.length)}>登録</button>
    </form>
    {draft && <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />}
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={deleting !== null} title={`${subject}を削除`} message={deleting ? `「${coded ? `${deleting.code} ` : ""}${deleting.name}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="account-master-list" role="region" aria-label={`${subject}一覧`} tabIndex={0}>
      <table className={`account-master-table ${slug}-master-table`} aria-label={`${subject}一覧`}>
        <thead><tr>{coded && <th scope="col">{subject}コード</th>}<th scope="col">{subject}名</th>{industryOptions && <th scope="col">業種名</th>}<th scope="col">操作</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={(coded ? 3 : 2) + (industryOptions ? 1 : 0)} className="page-description">{subject}はまだ登録されていません。</td></tr>}
          {rows.map(item => {
            const editing = draft?.id === item.id ? draft : null;
            return <tr key={item.id} className={editing ? "master-row-editing" : undefined} onKeyDown={event => {
              if (editing && (event.key === "Escape" || event.key === "Enter") && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation();
                if (!autoSave.pending) controller.end();
              }
            }}>
              {coded && <td className="account-code">{editing ? <input autoFocus aria-label={`${item.name}の${subject}コード`} inputMode="numeric" value={editing.code} onChange={event => controller.change({ ...editing, code: event.target.value })} /> : item.code}</td>}
              <th scope="row" className="account-master-name">{editing ? <input autoFocus={!coded} aria-label={`${item.name}の${subject}名`} value={editing.name} onChange={event => controller.change({ ...editing, name: event.target.value })} /> : item.name}</th>
              {industryOptions && <td>{editing ? industryChoices(editing.industryIds ?? [], industryIds => controller.change({ ...editing, industryIds }), readOnly, `${item.name}の業種名`) : industryOptions.filter(option => item.industryIds?.includes(option.id)).map(option => option.name).join("・")}</td>}
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
