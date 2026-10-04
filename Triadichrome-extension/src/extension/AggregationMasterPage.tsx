import { useCallback, useRef, useState } from "react";
import { type Account } from "../core/accountMaster";
import { type Aggregation, type AggregationMember } from "../core/aggregations";
import { type AggregationChange } from "../core/aggregationMaster";
import { StatusNotice } from "./StatusNotice";
import { ConfirmationDialog } from "./ConfirmationDialog";

type Props = { accounts: Account[]; groups: Aggregation[]; isSaving: boolean; onChange: (change: AggregationChange) => Promise<void>; onBack: () => void };
type MemberDraft = { key: number; target: string; sign: 1 | -1 };
type Draft = { id: number; name: string; members: MemberDraft[] };

export function AggregationMasterPage({ accounts, groups, isSaving, onChange, onBack }: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Aggregation | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismiss = useCallback(() => setNotice({ message: "", error: false }), []);
  const serial = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const focusEdit = useRef<number | null>(null);
  const targets = [
    ...accounts.map(account => ({ value: `account:${account.id}`, label: `${account.accountCode ?? "未設定"} ${account.accountName}` })),
    ...groups.map(group => ({ value: `group:${group.id}`, label: group.name })),
  ];
  const label = (member: AggregationMember) => targets.find(target => target.value === `${member.kind}:${member.id}`)!.label;
  const owners = new Map<string, number>(groups.flatMap(group => group.members.map(member => [`${member.kind}:${member.id}`, group.id] as const)));
  const ancestors = new Set<number>();
  let ancestor = editing?.id;
  while (ancestor !== undefined) { ancestors.add(ancestor); ancestor = owners.get(`group:${ancestor}`); }
  const save = async (change: AggregationChange) => {
    dismiss();
    try {
      await onChange(change);
      if (change.type === "add") { setName(""); nameInput.current?.focus({ preventScroll: true }); }
      if (change.type === "update") { focusEdit.current = change.id; setEditing(null); }
      setDeleting(null);
      setNotice({ message: change.type === "delete" ? "集計を削除しました。" : "集計を保存しました。", error: false });
    } catch (failure) {
      setDeleting(null);
      const cancelled = failure instanceof DOMException && failure.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : failure instanceof Error ? failure.message : "保存できませんでした。", error: !cancelled });
    }
  };
  const edit = (group: Aggregation) => { dismiss(); setEditing({ id: group.id, name: group.name, members: group.members.map(member => ({ key: serial.current++, target: `${member.kind}:${member.id}`, sign: member.sign })) }); };
  const cancel = () => { focusEdit.current = editing?.id ?? null; setEditing(null); dismiss(); };
  const updateMember = (key: number, change: Partial<MemberDraft>) => setEditing(current => current && ({ ...current, members: current.members.map(member => member.key === key ? { ...member, ...change } : member) }));

  return <main className="master-page" aria-labelledby="aggregation-master-title" aria-busy={isSaving}>
    <button type="button" className="text-button master-back" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="aggregation-master-title">集計マスタ</h1>
    <p className="page-description">科目・集計を一つの所属先にまとめ、＋・−で計算します。必須の4集計は削除できません。</p>
    <form className="account-master-form" onSubmit={event => { event.preventDefault(); if (!isSaving) void save({ type: "add", name }); }}>
      <div className="initiative-field"><label htmlFor="aggregation-name">集計名</label>
        <input id="aggregation-name" ref={nameInput} value={name} disabled={isSaving || editing !== null} onChange={event => setName(event.target.value)} autoComplete="off" />
      </div>
      <div className="form-actions"><button type="submit" className="primary-button" disabled={isSaving || editing !== null || !name.trim()}>登録</button></div>
    </form>
    <StatusNotice {...notice} onDismiss={dismiss} />
    <ConfirmationDialog open={deleting !== null} title="集計を削除" message={deleting ? `「${deleting.name}」を削除しますか？` : ""} confirmLabel="削除する" busy={isSaving}
      onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting && !isSaving) void save({ type: "delete", id: deleting.id }); }} />
    <div className="aggregation-list" role="region" aria-label="集計一覧" tabIndex={0}>
      <table className="account-master-table aggregation-table" aria-label="集計一覧">
        <thead><tr><th scope="col">集計名</th><th scope="col">計算対象</th><th scope="col">操作</th></tr></thead>
        <tbody>{groups.map(group => {
          const draft = editing?.id === group.id ? editing : null;
          const inUse = group.members.length > 0 || owners.has(`group:${group.id}`);
          const formId = `aggregation-edit-${group.id}`;
          return <tr key={group.id} onKeyDown={event => { if (draft && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!isSaving) cancel(); } }}>
            <th scope="row" className="account-master-name">
              {draft && !group.required ? <input autoFocus form={formId} aria-label={`${group.name}の集計名`} value={draft.name} disabled={isSaving} onChange={event => setEditing({ ...draft, name: event.target.value })} /> : group.name}
              {group.required && <span className="required-marker">必須</span>}
            </th>
            <td>{draft ? <div className="aggregation-members">
              {draft.members.map((member, index) => <div className="aggregation-member" key={member.key}>
                <select form={formId} aria-label={`${index + 1}番目の加減算`} value={member.sign} disabled={isSaving} onChange={event => updateMember(member.key, { sign: Number(event.target.value) as 1 | -1 })}>
                  <option value={1}>＋</option><option value={-1}>−</option>
                </select>
                <select form={formId} aria-label={`${index + 1}番目の集計対象`} value={member.target} disabled={isSaving} onChange={event => updateMember(member.key, { target: event.target.value })}>
                  <option value="">科目・集計を選択</option>
                  {targets.map(target => {
                    const owner = owners.get(target.value);
                    const blocked = (owner !== undefined && owner !== group.id) || draft.members.some(other => other.key !== member.key && other.target === target.value)
                      || (target.value.startsWith("group:") && ancestors.has(Number(target.value.split(":")[1])));
                    return <option key={target.value} value={target.value} disabled={blocked}>{target.label}{owner !== undefined && owner !== group.id ? "（所属済み）" : ""}</option>;
                  })}
                </select>
                <button type="button" className="text-button" disabled={isSaving} aria-label={`${index + 1}番目の対象を外す`} onClick={() => setEditing({ ...draft, members: draft.members.filter(item => item.key !== member.key) })}>×</button>
              </div>)}
              <button type="button" className="text-button" disabled={isSaving} onClick={() => setEditing({ ...draft, members: [...draft.members, { key: serial.current++, target: "", sign: 1 }] })}>＋ 対象を追加</button>
            </div> : <span className="aggregation-expression">{group.members.length ? group.members.map(member => `${member.sign === 1 ? "＋" : "−"} ${label(member)}`).join("　") : "未設定"}</span>}</td>
            <td>{draft ? <form id={formId} className="form-actions" onSubmit={event => {
              event.preventDefault();
              if (!isSaving) void save({ type: "update", id: group.id, name: draft.name, members: draft.members.map(member => {
                const [kind, id] = member.target.split(":");
                return { kind: kind as AggregationMember["kind"], id: Number(id), sign: member.sign };
              }) });
            }}>
              <button type="submit" className="text-button" disabled={isSaving || !draft.name.trim() || draft.members.some(member => !member.target)}>保存</button>
              <button type="button" className="text-button" disabled={isSaving} onClick={cancel}>キャンセル</button>
            </form> : <div className="form-actions">
              <button type="button" className="text-button" ref={button => { if (button && focusEdit.current === group.id) { button.focus({ preventScroll: true }); focusEdit.current = null; } }} aria-label={`${group.name}を編集`} disabled={isSaving || editing !== null} onClick={() => edit(group)}>編集</button>
              <button type="button" className="text-button" aria-label={`${group.name}を削除`} disabled={isSaving || editing !== null || group.required !== null || inUse} title={group.required ? "必須集計は削除できません" : inUse ? "先に所属を解除してください" : undefined} onClick={() => { dismiss(); setDeleting(group); }}>削除</button>
            </div>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </main>;
}
