import { useMasterOperation } from "./useMasterOperation";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useRef, useState } from "react";
import { type Account } from "../core/domain/accountMaster";
import { type Aggregation, type AggregationMember } from "../core/domain/aggregations";
import { type AggregationChange } from "../core/domain/aggregationMaster";
import { StatusNotice } from "./StatusNotice";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { AggregationGraph } from "./AggregationGraph";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";

type Props = AutoSaveProps & { accounts: Account[]; groups: Aggregation[]; isSaving: boolean; onChange: (change: AggregationChange) => Promise<void>; onBack: () => void };
type MemberDraft = { key: number; target: string; sign: 1 | -1 };
type Draft = { id: number; name: string; displayName: string; members: MemberDraft[] };

export function AggregationMasterPage({ accounts, groups, isSaving, onChange, onBack, onPendingChange, onPrepareSave }: Props) {
  const [name, setName] = useState("");
  const readOnly = useHistoryReadOnly();
  const [adding, setAdding] = useState(false);
  const autoSave = useAutoSave<Draft>(draft => {
    if (draft.members.some(member => !member.target)) throw new Error("集計対象を選択してください。");
    return onChange({ type: "update", id: draft.id, name: draft.name, displayName: draft.displayName, members: draft.members.map(member => {
      const [kind, id] = member.target.split(":");
      return { kind: kind as AggregationMember["kind"], id: Number(id), sign: member.sign };
    }) });
  }, onPendingChange);
  const { draft: editing, controller } = autoSave;
  const setEditing = (draft: Draft) => controller.change(draft);
  const [deleting, setDeleting] = useState<Aggregation | null>(null);
  const serial = useRef(0);
  const page = useRef<HTMLElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const targets = [
    ...accounts.map(account => ({ value: `account:${account.id}`, label: `${account.accountCode ?? "未設定"} ${account.accountName}` })),
    ...groups.map(group => ({ value: `group:${group.id}`, label: group.name })),
  ];
  const owners = new Map<string, number>(groups.flatMap(group => group.members.map(member => [`${member.kind}:${member.id}`, group.id] as const)));
  const ancestors = new Set<number>();
  let ancestor = editing?.id;
  while (ancestor !== undefined) { ancestors.add(ancestor); ancestor = owners.get(`group:${ancestor}`); }
  const focusGroup = (id: number) => requestAnimationFrame(() => page.current?.querySelector<HTMLButtonElement>(`[data-move-key="group:${id}"]`)?.focus({ preventScroll: true }));
  const { notice, dismiss, save } = useMasterOperation<AggregationChange>({
    onChange,
    onSuccess: change => {
      if (change.type === "add") { setName(""); setAdding(false); requestAnimationFrame(() => addButton.current?.focus({ preventScroll: true })); }
      setDeleting(null);
    },
    onFailure: () => setDeleting(null),
    successMessage: change => change.type === "delete" ? "集計を削除しました。" : change.type === "move" ? "所属・加減算を保存しました。" : "集計を保存しました。",
    cancelledMessage: change => change.type === "move" ? "保存をキャンセルしました。元の所属を保っています。" : "保存をキャンセルしました。入力内容は残っています。",
  });
  const edit = (group: Aggregation) => { dismiss(); controller.begin({ id: group.id, name: group.name, displayName: group.displayName ?? group.name, members: group.members.map(member => ({ key: serial.current++, target: `${member.kind}:${member.id}`, sign: member.sign })) }); };
  const cancel = () => { if (editing) focusGroup(editing.id); controller.end(); dismiss(); };
  const updateMember = (key: number, change: Partial<MemberDraft>) => editing && setEditing({ ...editing, members: editing.members.map(member => member.key === key ? { ...member, ...change } : member) });
  const editor = (group: Aggregation) => {
    const draft = editing;
    if (!draft || draft.id !== group.id) return null;
    return <form className="graph-editor" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!autoSave.pending) cancel(); }
    }} onSubmit={event => {
      event.preventDefault();
      if (!autoSave.pending) cancel();
    }}>
      {!group.required && <input autoFocus aria-label={`${group.name}の集計名`} value={draft.name} onChange={event => setEditing({ ...draft, name: event.target.value })} />}
      <label>総原価表の表示名<input aria-label={`${group.name}の総原価表の表示名`} value={draft.displayName} onChange={event => setEditing({ ...draft, displayName: event.target.value })} /></label>
      <div className="aggregation-members">
        {draft.members.map((member, index) => <div className="aggregation-member" key={member.key}>
          <select aria-label={`${index + 1}番目の加減算`} value={member.sign} onChange={event => updateMember(member.key, { sign: Number(event.target.value) as 1 | -1 })}>
            <option value={1}>＋</option><option value={-1}>−</option>
          </select>
          <select aria-label={`${index + 1}番目の集計対象`} value={member.target} onChange={event => updateMember(member.key, { target: event.target.value })}>
            <option value="">科目・集計を選択</option>
            {targets.map(target => {
              const owner = owners.get(target.value);
              const blocked = (owner !== undefined && owner !== group.id) || draft.members.some(other => other.key !== member.key && other.target === target.value)
                || (target.value.startsWith("group:") && ancestors.has(Number(target.value.split(":")[1])));
              return <option key={target.value} value={target.value} disabled={readOnly || blocked}>{target.label}{owner !== undefined && owner !== group.id ? "（所属済み）" : ""}</option>;
            })}
          </select>
          <button type="button" className="text-button" aria-label={`${index + 1}番目の対象を外す`} onClick={() => setEditing({ ...draft, members: draft.members.filter(item => item.key !== member.key) })}>×</button>
        </div>)}
        <button type="button" className="text-button" autoFocus={group.required !== null} onClick={() => setEditing({ ...draft, members: [...draft.members, { key: serial.current++, target: "", sign: 1 }] })}>＋ 対象を追加</button>
      </div>
      <div className="form-actions">
        <button type="submit" className="text-button" disabled={readOnly || autoSave.pending}>完了</button>
      </div>
      <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    </form>;
  };

  return <main ref={page} onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()} className="master-page aggregation-page" aria-labelledby="aggregation-master-title" aria-busy={isSaving}>
    <div className="aggregation-heading"><h1 id="aggregation-master-title">集計マスタ</h1>
      <div className="form-actions"><button type="button" className="text-button graph-back" aria-label="← マスタへ戻る" title="マスタへ戻る" disabled={isSaving || autoSave.pending} onClick={onBack}>←</button>
        <button ref={addButton} className="primary-button" type="button" disabled={readOnly || isSaving || editing !== null || adding} onClick={() => setAdding(true)}>＋ 集計を追加</button></div>
    </div>
    {adding && <form className="graph-add-form" onSubmit={event => { event.preventDefault(); if (!isSaving) void save({ type: "add", name }); }}>
      <div className="initiative-field"><label htmlFor="aggregation-name">集計名</label>
        <input id="aggregation-name" autoFocus value={name} disabled={readOnly || isSaving} onChange={event => setName(event.target.value)} autoComplete="off" />
      </div>
      <div className="form-actions"><button type="submit" className="primary-button" disabled={readOnly || isSaving || !name.trim()}>登録</button>
        <button type="button" className="text-button" disabled={readOnly || isSaving} onClick={() => { setAdding(false); addButton.current?.focus(); }}>キャンセル</button></div>
    </form>}
    <StatusNotice {...notice} onDismiss={dismiss} />
    <ConfirmationDialog open={deleting !== null} title="集計を削除" message={deleting ? `「${deleting.name}」を削除しますか？` : ""} confirmLabel="削除する" busy={isSaving}
      onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <AggregationGraph accounts={accounts} groups={groups} disabled={readOnly || isSaving || adding} editingId={editing?.id ?? null}
      renderEditor={editor} onEdit={edit} onDelete={group => { dismiss(); setDeleting(group); }}
      onMove={(member, parentId, sign) => save({ type: "move", member, parentId, sign })} />
  </main>;
}
