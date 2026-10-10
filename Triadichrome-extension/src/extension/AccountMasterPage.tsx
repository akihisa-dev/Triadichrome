import { useLayoutEffect, useRef, useState } from "react";
import { type Account, type AccountChange } from "../core/domain/accountMaster";
import { type Aggregation } from "../core/domain/aggregations";
import { type AggregationChange } from "../core/domain/aggregationMaster";
import { accountTypes, type AccountType } from "../core/domain/accountTypes";
import { masterRowKey, orderedMasterRows, type MasterRow } from "../core/domain/masterRows";
import { aggregationForbidden } from "../core/tables/aggregationGraph";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { useMasterOperation } from "./useMasterOperation";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";
import { StatusNotice } from "./StatusNotice";
import { MasterSignSelector } from "./MasterSignSelector";
import { ConfirmationDialog } from "./ConfirmationDialog";

type Props = AutoSaveProps & { accounts: Account[]; groups: Aggregation[]; usedAccountIds: Set<number>; isSaving: boolean; onChange: (change: AccountChange) => Promise<void>; onChangeAggregations: (change: AggregationChange) => Promise<void>; onBack: () => void };
type Draft = MasterRow & { code: string; name: string; displayName: string; attribute: AccountType | "" };
type Operation = {kind:"account"; change:AccountChange} | {kind:"group"; change:AggregationChange};

export function AccountMasterPage({ accounts, groups, usedAccountIds, isSaving, onChange, onChangeAggregations, onBack, onPendingChange, onPrepareSave }: Props) {
  const readOnly = useHistoryReadOnly();
  const rows = orderedMasterRows(accounts,groups);
  const byAccount = new Map(accounts.map(item => [item.id,item]));
  const byGroup = new Map(groups.map(item => [item.id,item]));
  const owners = new Map(groups.flatMap(group => group.members.map(member => [masterRowKey(member),{parent:group.id,sign:member.sign}] as const)));
  const empty = (): Draft => ({kind:"account",id:0,code:"",name:"",displayName:"",attribute:""});
  const [adding,setAdding] = useState<Draft>(empty);
  const [deleting,setDeleting] = useState<MasterRow | null>(null);
  const [dragged,setDragged] = useState<MasterRow | null>(null);
  const [drop,setDrop] = useState<{key:string;before:boolean} | null>(null);
  const elements = useRef(new Map<string,HTMLTableRowElement>());
  const positions = useRef<Map<string,number> | null>(null);
  const focus = (row: MasterRow) => requestAnimationFrame(() => elements.current.get(masterRowKey(row))?.querySelector<HTMLButtonElement>("[data-edit]")?.focus({preventScroll:true}));
  const changeAccount = (change:AccountChange) => onChange({...change,presentationOrder:rows});
  const changeGroup = (change:AggregationChange) => onChangeAggregations({...change,presentationOrder:rows});
  const perform = (operation: Operation) => operation.kind === "account" ? changeAccount(operation.change) : changeGroup(operation.change);
  const autoSave = useAutoSave<Draft>(draft => draft.kind === "account"
    ? changeAccount({type:"update",id:draft.id,accountCode:draft.code,accountName:draft.name,accountType:draft.attribute,displayName:draft.displayName})
    : changeGroup({type:"update",id:draft.id,name:draft.name,displayName:draft.displayName,members:byGroup.get(draft.id)!.members}),onPendingChange);
  const {draft:editing,controller} = autoSave;
  const {notice,dismiss,save} = useMasterOperation<Operation>({onChange:perform,onSuccess:operation => { if(operation.change.type === "add") setAdding(empty()); setDeleting(null); },onFailure:() => {positions.current=null;setDeleting(null);},successMessage:() => "マスタを保存しました。",cancelledMessage:() => "保存をキャンセルしました。元の内容を保っています。"});
  const disabled = readOnly || isSaving || editing !== null;
  useLayoutEffect(() => {
    if (!positions.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [key,element] of elements.current) {
      const previous=positions.current.get(key); if(previous === undefined) continue;
      const delta=previous-element.getBoundingClientRect().top;
      if(delta) element.animate(reduced ? [{opacity:.5},{opacity:1}] : [{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}], {duration:reduced ? 80 : 220,easing:"ease-out"});
    }
    positions.current=null;
  },[accounts,groups]);
  const reorder = (row:MasterRow,target:MasterRow,before:boolean) => {
    if(disabled || masterRowKey(row) === masterRowKey(target)) return;
    const order=rows.filter(item => masterRowKey(item) !== masterRowKey(row));
    order.splice(order.findIndex(item => masterRowKey(item) === masterRowKey(target))+(before ? 0 : 1),0,row);
    if(order.every((item,index) => masterRowKey(item) === masterRowKey(rows[index]!))) return;
    positions.current=new Map([...elements.current].map(([key,element]) => [key,element.getBoundingClientRect().top]));
    void save({kind:"group",change:{type:"reorder",order}});
  };
  const rename = (draft:Draft,name:string) => ({...draft,name,displayName:draft.displayName === draft.name ? name : draft.displayName});
  const end = () => {if(editing) focus(editing);controller.end();dismiss();};
  return <main className="master-page account-master-page master-data-page unified-master-page" aria-labelledby="account-master-title" aria-busy={isSaving} onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <div className="account-master-heading"><button type="button" className="text-button master-back" disabled={isSaving || autoSave.pending} onClick={onBack}>← マスタへ戻る</button><h1 id="account-master-title">勘定科目マスタ</h1><span className="master-count">{accounts.length}科目・{groups.length}集計</span></div>
    <form className="account-master-form" aria-label="科目・集計の新規登録" onSubmit={event => {event.preventDefault();if(disabled) return;void save(adding.kind === "account" ? {kind:"account",change:{type:"add",accountCode:adding.code,accountName:adding.name,accountType:adding.attribute,displayName:adding.displayName}} : {kind:"group",change:{type:"add",name:adding.name,displayName:adding.displayName}});}}>
      <span className="master-form-label">新規登録</span>
      <div className="initiative-field account-code-field"><label htmlFor="account-code">科目コード</label><input name="accountCode" id="account-code" value={adding.kind === "account" ? adding.code : ""} disabled={disabled || adding.kind === "group"} inputMode="numeric" autoComplete="off" onChange={event => setAdding({...adding,code:event.target.value})}/></div>
      <div className="initiative-field"><label htmlFor="account-name">名称</label><input name="accountName" id="account-name" value={adding.name} disabled={disabled} autoComplete="off" onChange={event => setAdding(rename(adding,event.target.value))}/></div>
      <div className="initiative-field"><label htmlFor="master-display-name">表示名</label><input id="master-display-name" value={adding.displayName} disabled={disabled} autoComplete="off" onChange={event => setAdding({...adding,displayName:event.target.value})}/></div>
      <div className="initiative-field account-type-field"><label htmlFor="account-type">科目属性</label><select id="account-type" value={adding.kind === "group" ? "group" : adding.attribute} disabled={disabled} onChange={event => setAdding({...adding,kind:event.target.value === "group" ? "group" : "account",attribute:event.target.value === "group" ? "" : event.target.value as Draft["attribute"]})}><option value="">属性を選択</option>{Object.entries(accountTypes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}<option value="group">集計</option></select></div>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={disabled || !adding.name.trim() || !adding.displayName.trim() || (adding.kind === "account" && (!adding.code.trim() || !adding.attribute))}>登録</button></div>
    </form>
    <StatusNotice {...notice} onDismiss={dismiss}/>
    <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave}/>
    <ConfirmationDialog open={deleting !== null} title={deleting?.kind === "account" ? "勘定科目を削除" : "集計を削除"} message={deleting ? `「${deleting.kind === "account" ? (byAccount.get(deleting.id)?.accountCode + " " + byAccount.get(deleting.id)?.accountName) : byGroup.get(deleting.id)?.name}」を削除しますか？` : ""} confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleting(null)} onConfirm={() => {if(deleting && !isSaving) void save(deleting.kind === "account" ? {kind:"account",change:{type:"delete",id:deleting.id}} : {kind:"group",change:{type:"delete",id:deleting.id}});}}/>
    <div className="account-master-list" role="region" aria-label="科目・集計一覧" tabIndex={0}><table className="account-master-table" aria-label="科目・集計一覧"><thead><tr>{["順序","科目コード","名称","表示名","科目属性","集計","加減","操作"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      {rows.map((row,index) => {
        const key=masterRowKey(row),account=row.kind === "account" ? byAccount.get(row.id)! : null,group=row.kind === "group" ? byGroup.get(row.id)! : null;
        const name=account?.accountName ?? group!.name;
        const draft=editing && masterRowKey(editing) === key ? editing : null;
        const owner=owners.get(key), forbidden=aggregationForbidden(groups,row);
        const cannotDelete=account ? account.inUse || usedAccountIds.has(account.id) : !!group!.required || group!.members.length>0 || !!owner;
        return <tr key={key} ref={element => {if(element) elements.current.set(key,element);else elements.current.delete(key);}} className={`${draft ? "master-row-editing" : ""} ${drop?.key === key ? drop.before ? "drop-before" : "drop-after" : ""}`} onDragOver={event => {if(!dragged || disabled) return;event.preventDefault();setDrop({key,before:event.clientY < event.currentTarget.getBoundingClientRect().top+event.currentTarget.getBoundingClientRect().height/2});}} onDrop={event => {event.preventDefault();if(dragged && drop) reorder(dragged,row,drop.before);setDragged(null);setDrop(null);}} onKeyDown={event => {if(draft && event.key === "Escape" && !autoSave.pending){event.preventDefault();event.stopPropagation();end();}}}>
          <td><button type="button" className="text-button account-drag-handle" aria-label={`${name}を並べ替え`} disabled={disabled} draggable={!disabled} onDragStart={event => {event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",key);setDragged(row);}} onDragEnd={() => {setDragged(null);setDrop(null);}} onKeyDown={event => {if(event.key !== "ArrowUp" && event.key !== "ArrowDown") return;event.preventDefault();const target=rows[index+(event.key === "ArrowUp" ? -1 : 1)];if(target) reorder(row,target,event.key === "ArrowUp");}}>⠿</button></td>
          <td className={account ? "account-code" : undefined}>{account && (draft ? <input autoFocus aria-label={`${name}の科目コード`} value={draft.code} inputMode="numeric" onChange={event => controller.change({...draft,code:event.target.value})}/> : account.accountCode)}</td>
          <th scope="row">{draft && !group?.required ? <input autoFocus={row.kind === "group"} aria-label={`${name}の名称`} value={draft.name} onChange={event => controller.change(rename(draft,event.target.value))}/> : name}</th>
          <td>{draft ? <input autoFocus={!!group?.required} aria-label={`${name}の表示名`} value={draft.displayName} onChange={event => controller.change({...draft,displayName:event.target.value})}/> : account?.displayName ?? group?.displayName ?? name}</td>
          <td>{account ? (draft ? <select aria-label={`${name}の科目属性`} value={draft.attribute} onChange={event => controller.change({...draft,attribute:event.target.value as Draft["attribute"]})}><option value="">属性を選択</option>{Object.entries(accountTypes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className="master-type-badge">{account.accountType ? accountTypes[account.accountType] : "未設定"}</span>) : <span className="master-type-badge">集計</span>}</td>
          <td><select aria-label={`${name}の集計`} value={owner?.parent ?? ""} disabled={disabled} onChange={event => void save({kind:"group",change:{type:"move",member:row,parentId:event.target.value ? Number(event.target.value) : null,sign:owner?.sign ?? 1}})}><option value="">未所属</option>{groups.map(item => <option key={item.id} value={item.id} disabled={forbidden.has(item.id)}>{item.name}</option>)}</select></td>
          <td><MasterSignSelector name={name} value={owner?.sign ?? null} disabled={disabled || !owner} onChange={sign => save({kind:"group",change:{type:"move",member:row,parentId:owner!.parent,sign}})}/></td>
          <td><div className="form-actions">{draft ? <button type="button" className="text-button" disabled={autoSave.pending} onClick={end}>完了</button> : <><button type="button" data-edit className="text-button" aria-label={`${name}を編集`} disabled={disabled} onClick={() => {dismiss();controller.begin({...row,code:account?.accountCode ?? "",name,displayName:account?.displayName ?? group?.displayName ?? name,attribute:account?.accountType ?? ""});}}>編集</button><button type="button" className="text-button" aria-label={`${name}を削除`} disabled={disabled || cannotDelete} onClick={() => {dismiss();setDeleting(row);}}>削除</button></>}</div></td>
        </tr>;
      })}
    </tbody></table></div>
  </main>;
}
