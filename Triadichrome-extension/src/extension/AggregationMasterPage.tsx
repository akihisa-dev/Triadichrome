import { useMasterOperation } from "./useMasterOperation";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useRef, useState } from "react";
import { type Account } from "../core/domain/accountMaster";
import { type Aggregation, type AggregationMember } from "../core/domain/aggregations";
import { type AggregationChange } from "../core/domain/aggregationMaster";
import { StatusNotice } from "./StatusNotice";
import { ConfirmationDialog } from "./ConfirmationDialog";
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
  const focusGroup = (id: number) => requestAnimationFrame(() => page.current?.querySelector<HTMLButtonElement>(`[data-edit-id="${id}"]`)?.focus({ preventScroll: true }));
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
    return <form className="aggregation-editor" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!autoSave.pending) cancel(); }
    }} onSubmit={event => {
      event.preventDefault();
      if (!autoSave.pending) cancel();
    }}>
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
        <button type="button" className="text-button" onClick={() => setEditing({ ...draft, members: [...draft.members, { key: serial.current++, target: "", sign: 1 }] })}>＋ 対象を追加</button>
      </div>
      <div className="form-actions">
        <button type="submit" className="text-button" disabled={readOnly || autoSave.pending}>完了</button>
      </div>
      <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    </form>;
  };

  const memberLabels = (group: Aggregation) => <div className="aggregation-targets">{group.members.length ? group.members.map(member => <span key={`${member.kind}:${member.id}`}><b>{member.sign === 1 ? "＋" : "−"}</b> {targets.find(target => target.value === `${member.kind}:${member.id}`)?.label}</span>) : <span className="required-marker">未設定</span>}</div>;

  const membership = (member: Pick<AggregationMember, "kind" | "id">, label: string) => {
    const parentId = owners.get(`${member.kind}:${member.id}`) ?? null;
    const parent = groups.find(group => group.id === parentId);
    const sign = parent?.members.find(item => item.kind === member.kind && item.id === member.id)?.sign ?? 1;
    const blocked = new Set<number>();
    const collect = (id: number) => {
      if (blocked.has(id)) return;
      blocked.add(id);
      for (const child of groups.find(group => group.id === id)?.members ?? []) if (child.kind === "group") collect(child.id);
    };
    if (member.kind === "group") collect(member.id);
    const disabled = readOnly || isSaving || adding || editing !== null;
    return <>
      <td><select aria-label={`${label}の所属先`} value={parentId ?? ""} disabled={disabled}
        onChange={event => void save({ type: "move", member, parentId: event.target.value ? Number(event.target.value) : null, sign })}>
        <option value="">未所属</option>
        {groups.map(group => <option key={group.id} value={group.id} disabled={blocked.has(group.id)}>{group.name}</option>)}
      </select></td>
      <td><select aria-label={`${label}の加減算`} value={parentId === null ? "" : sign} disabled={disabled || parentId === null}
        onChange={event => void save({ type: "move", member, parentId, sign: Number(event.target.value) as 1 | -1 })}>
        {parentId === null && <option value="">—</option>}<option value={1}>＋</option><option value={-1}>−</option>
      </select></td>
    </>;
  };

  return <main ref={page} onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()} className="master-page aggregation-page master-data-page" aria-labelledby="aggregation-master-title" aria-busy={isSaving}>
    <div className="aggregation-heading"><h1 id="aggregation-master-title">集計マスタ</h1><span className="master-count">{groups.length}集計・{accounts.length}科目</span>
      <div className="form-actions"><button type="button" className="text-button master-back" aria-label="← マスタへ戻る" title="マスタへ戻る" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button>
        <button ref={addButton} className="primary-button" type="button" disabled={readOnly || isSaving || editing !== null || adding} onClick={() => setAdding(true)}>＋ 集計を追加</button></div>
    </div>
    {adding && <form className="aggregation-add-form" aria-label="集計の新規登録" onSubmit={event => { event.preventDefault(); if (!isSaving) void save({ type: "add", name }); }}>
      <span className="master-form-label">新規登録</span><div className="initiative-field"><label htmlFor="aggregation-name">集計名</label>
        <input id="aggregation-name" autoFocus value={name} disabled={readOnly || isSaving} onChange={event => setName(event.target.value)} autoComplete="off" />
      </div>
      <div className="form-actions"><button type="submit" className="primary-button" disabled={readOnly || isSaving || !name.trim()}>登録</button>
        <button type="button" className="text-button" disabled={readOnly || isSaving} onClick={() => { setAdding(false); addButton.current?.focus(); }}>キャンセル</button></div>
    </form>}
    <StatusNotice {...notice} onDismiss={dismiss} />
    <ConfirmationDialog open={deleting !== null} title="集計を削除" message={deleting ? `「${deleting.name}」を削除しますか？` : ""} confirmLabel="削除する" busy={isSaving}
      onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="aggregation-list" role="region" aria-label="集計・科目一覧" tabIndex={0}>
      <table className="aggregation-table" aria-label="集計・科目一覧">
        <thead><tr>{["区分", "集計名・科目名", "総原価表の表示名", "計算対象", "所属先", "加減算", "操作"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{groups.map(group => {
          const draft = editing?.id === group.id ? editing : null;
          return <tr key={group.id} className={draft ? "master-row-editing" : undefined} onKeyDown={event => {
            if (draft && event.key === "Escape" && !autoSave.pending) { event.preventDefault(); event.stopPropagation(); cancel(); }
          }}>
            <td>集計{group.required && <span className="required-marker"> 必須</span>}</td>
            <th scope="row">{draft && !group.required
              ? <input autoFocus aria-label={`${group.name}の集計名`} value={draft.name} onChange={event => setEditing({ ...draft, name: event.target.value })} />
              : <button className="text-button" data-edit-id={group.id} aria-label={`${group.name}を編集`} disabled={readOnly || isSaving || editing !== null || adding} onClick={() => edit(group)}>{group.name}</button>}</th>
            <td>{draft ? <input autoFocus={!!group.required} aria-label={`${group.name}の総原価表の表示名`} value={draft.displayName} onChange={event => setEditing({ ...draft, displayName: event.target.value })} /> : group.displayName ?? group.name}</td>
            <td>{draft ? editor(group) : group.members.length > 4 ? <details className="aggregation-target-details"><summary>{group.members.length}件の計算対象</summary>{memberLabels(group)}</details> : memberLabels(group)}</td>
            {membership({ kind: "group", id: group.id }, group.name)}
            <td><button type="button" className="text-button" aria-label={`${group.name}を削除`} disabled={readOnly || isSaving || editing !== null || adding || !!group.required || group.members.length > 0 || owners.has(`group:${group.id}`)} onClick={() => { dismiss(); setDeleting(group); }}>削除</button></td>
          </tr>;
        })}
        {accounts.map(account => <tr key={`account:${account.id}`}>
          <td>科目</td><th scope="row">{account.accountCode} {account.accountName}</th><td>{account.accountName}</td><td>—</td>
          {membership({ kind: "account", id: account.id }, `${account.accountCode ?? "未設定"} ${account.accountName}`)}<td>—</td>
        </tr>)}</tbody>
      </table>
    </div>
  </main>;
}
