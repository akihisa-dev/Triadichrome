import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Account, type AccountChange } from "../core/accountMaster";
import { accountTypes, type AccountType } from "../core/accountTypes";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { StatusNotice } from "./StatusNotice";

type AccountMasterPageProps = {
  accounts: Account[];
  usedAccountIds: Set<number>;
  isSaving: boolean;
  onChange: (change: AccountChange) => Promise<void>;
  onBack: () => void;
};

export function AccountMasterPage({ accounts, usedAccountIds, isSaving, onChange, onBack }: AccountMasterPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const focusAfterSave = useRef(false);
  const focusAfterEdit = useRef<number | null>(null);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType | "">("");
  const [editing, setEditing] = useState<{ id: number; accountCode: string; accountName: string; accountType: AccountType | "" } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: number; before: boolean } | null>(null);
  const rowElements = useRef(new Map<number, HTMLTableSectionElement>());
  const previousPositions = useRef<Map<number, number> | null>(null);
  useLayoutEffect(() => {
    if (!previousPositions.current) return;
    const style = getComputedStyle(document.documentElement);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [id, element] of rowElements.current) {
      const previous = previousPositions.current.get(id);
      if (previous === undefined) continue;
      const delta = previous - element.getBoundingClientRect().top;
      if (delta) element.animate(
        reduced ? [{ opacity: 0.5 }, { opacity: 1 }] : [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: parseFloat(style.getPropertyValue(reduced ? "--motion-fade" : "--motion-layout")), easing: style.getPropertyValue("--motion-ease").trim() });
    }
    previousPositions.current = null;
  }, [accounts]);
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  useEffect(() => {
    if (!isSaving && focusAfterSave.current) {
      focusAfterSave.current = false;
      input.current?.focus({ preventScroll: true });
    }
  }, [isSaving]);
  const save = async (change: AccountChange) => {
    setNotice({ message: "", error: false });
    try {
      await onChange(change);
      if (change.type === "add") {
        setAccountCode("");
        setAccountName("");
        setAccountType("");
        focusAfterSave.current = true;
      } else if (change.type === "update") {
        focusAfterEdit.current = change.id;
        setEditing(null);
      }
      setDeleteDialogOpen(false);
      setNotice({ message: change.type === "delete" ? "勘定科目を削除しました。" : change.type === "reorder" ? "科目の並び順を保存しました。" : "勘定科目を保存しました。", error: false });
    } catch (failure) {
      previousPositions.current = null;
      setDeleteDialogOpen(false);
      const cancelled = failure instanceof DOMException && failure.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : failure instanceof Error ? failure.message : "保存できませんでした。", error: !cancelled });
    }
  };
  const reorder = (id: number, targetId: number, before: boolean) => {
    if (isSaving || editing || id === targetId) return;
    const ids = accounts.map(account => account.id).filter(item => item !== id);
    ids.splice(ids.indexOf(targetId) + (before ? 0 : 1), 0, id);
    if (ids.every((item, index) => item === accounts[index]!.id)) return;
    previousPositions.current = new Map([...rowElements.current].map(([key, element]) => [key, element.getBoundingClientRect().top]));
    void save({ type: "reorder", ids });
  };
  const cancelEditing = () => {
    focusAfterEdit.current = editing?.id ?? null;
    setEditing(null);
    setNotice({ message: "", error: false });
  };

  return <main className="master-page" aria-labelledby="account-master-title" aria-busy={isSaving}>
    <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="account-master-title">勘定科目マスタ</h1>
    <p className="page-description">この計画で使う勘定科目を管理します。変更は計画ファイルに保存されます。</p>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving) void save({ type: "add", accountCode, accountName, accountType });
    }}>
      <div className="account-master-fields">
        <div className="initiative-field account-code-field">
          <label htmlFor="account-code">科目コード</label>
          <input ref={input} id="account-code" name="accountCode" type="text" inputMode="numeric" autoComplete="off" aria-describedby="account-code-hint" value={accountCode} disabled={isSaving} onChange={event => setAccountCode(event.target.value)} />
          <span id="account-code-hint" className="field-hint">半角数字3桁</span>
        </div>
        <div className="initiative-field">
          <label htmlFor="account-name">科目名</label>
          <input id="account-name" name="accountName" autoComplete="off" value={accountName} disabled={isSaving} onChange={event => setAccountName(event.target.value)} />
        </div>
        <div className="initiative-field account-type-field">
          <label htmlFor="account-type">科目属性</label>
          <select id="account-type" name="accountType" value={accountType} disabled={isSaving} onChange={event => setAccountType(event.target.value as AccountType | "")}>
            <option value="">属性を選択</option>
            {Object.entries(accountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSaving || !accountCode.trim() || !accountName.trim() || !accountType}>登録</button>
      </div>
    </form>
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={isDeleteDialogOpen} title="勘定科目を削除" message={deletingAccount ? `「${deletingAccount.accountCode} ${deletingAccount.accountName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleteDialogOpen(false)}
      onConfirm={() => { if (deletingAccount && !isSaving) void save({ type: "delete", id: deletingAccount.id }); }} />
    <div className="account-master-list" role="region" aria-label="勘定科目一覧" tabIndex={0}>
      <table className="account-master-table" aria-label="勘定科目一覧">
        <thead><tr><th scope="col">順序</th><th scope="col">科目コード</th><th scope="col">科目名</th><th scope="col">科目属性</th><th scope="col">操作</th></tr></thead>
        {accounts.length === 0 && <tbody><tr><td colSpan={5} className="page-description">勘定科目はまだ登録されていません。</td></tr></tbody>}
        {accounts.map((account, index) => {
          const inUse = account.inUse || usedAccountIds.has(account.id);
          const draft = editing?.id === account.id ? editing : null;
          const editFormId = `account-edit-${account.id}`;
          return <tbody key={account.id} ref={element => { if (element) rowElements.current.set(account.id, element); else rowElements.current.delete(account.id); }}
            className={dropTarget?.id === account.id ? dropTarget.before ? "drop-before" : "drop-after" : undefined}
            onDragOver={event => {
              if (dragged === null || isSaving || editing) return;
              event.preventDefault(); event.dataTransfer.dropEffect = "move";
              const bounds = event.currentTarget.getBoundingClientRect();
              setDropTarget({ id: account.id, before: event.clientY < bounds.top + bounds.height / 2 });
            }} onDrop={event => {
              if (dragged === null) return;
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              reorder(dragged, account.id, event.clientY < bounds.top + bounds.height / 2);
              setDragged(null); setDropTarget(null);
            }}>
            <tr onKeyDown={event => {
              if (draft && event.key === "Escape") {
                event.preventDefault(); event.stopPropagation();
                if (!isSaving) cancelEditing();
              }
            }}>
              <td><button type="button" className="text-button account-drag-handle" aria-label={`${account.accountName}を並べ替え`} title="ドラッグ、または上下キーで並べ替え"
                disabled={isSaving || editing !== null} draggable={!isSaving && editing === null}
                onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(account.id)); setDragged(account.id); }}
                onDragEnd={() => { setDragged(null); setDropTarget(null); }}
                onKeyDown={event => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  const target = accounts[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (target) reorder(account.id, target.id, event.key === "ArrowUp");
                }}>⠿</button></td>
              <td className="account-code">{draft
                ? <input autoFocus form={editFormId} name="accountCode" aria-label={`${account.accountName}の科目コード`} inputMode="numeric" autoComplete="off" value={draft.accountCode} disabled={isSaving} onChange={event => setEditing({ ...draft, accountCode: event.target.value })} />
                : account.accountCode ?? "未設定"}</td>
              <th scope="row" className="account-master-name">{draft
                ? <input form={editFormId} name="accountName" aria-label={`${account.accountName}の科目名`} autoComplete="off" value={draft.accountName} disabled={isSaving} onChange={event => setEditing({ ...draft, accountName: event.target.value })} />
                : account.accountName}</th>
              <td>{draft
                ? <select form={editFormId} name="accountType" aria-label={`${account.accountName}の科目属性`} value={draft.accountType} disabled={isSaving} onChange={event => setEditing({ ...draft, accountType: event.target.value as AccountType | "" })}>
                  <option value="">属性を選択</option>
                  {Object.entries(accountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                : account.accountType ? accountTypes[account.accountType] : "未設定"}</td>
              <td>{draft ? <form id={editFormId} className="form-actions" onSubmit={event => {
                event.preventDefault();
                if (!isSaving) void save({ type: "update", ...draft });
              }}>
                <button className="text-button" type="submit" disabled={isSaving || !draft.accountCode.trim() || !draft.accountName.trim() || !draft.accountType}>保存</button>
                <button className="text-button" type="button" disabled={isSaving} onClick={cancelEditing}>キャンセル</button>
              </form> : <div className="form-actions">
                <button ref={button => { if (button && focusAfterEdit.current === account.id) { button.focus({ preventScroll: true }); focusAfterEdit.current = null; } }} className="text-button" type="button" aria-label={`${account.accountName}を編集`} disabled={isSaving || editing !== null} onClick={() => { setEditing({ id: account.id, accountCode: account.accountCode ?? "", accountName: account.accountName, accountType: account.accountType ?? "" }); setNotice({ message: "", error: false }); }}>編集</button>
                <button className="text-button" type="button" aria-label={`${account.accountName}を削除`} disabled={isSaving || inUse || editing !== null} title={inUse ? "この科目を使う施策・明細・集計があるため削除できません" : undefined} onClick={() => { setDeletingAccount(account); setDeleteDialogOpen(true); dismissNotice(); }}>削除</button>
              </div>}</td>
            </tr>
          </tbody>;
        })}
      </table>
    </div>
  </main>;
}
