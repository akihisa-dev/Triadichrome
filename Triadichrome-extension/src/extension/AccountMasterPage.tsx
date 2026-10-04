import { useCallback, useEffect, useRef, useState } from "react";
import { type Account, type AccountChange } from "../core/accountMaster";
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
  const [editing, setEditing] = useState<{ id: number; accountCode: string; accountName: string } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
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
        focusAfterSave.current = true;
      } else if (change.type === "update") {
        focusAfterEdit.current = change.id;
        setEditing(null);
      }
      setDeleteDialogOpen(false);
      setNotice({ message: change.type === "delete" ? "勘定科目を削除しました。" : "勘定科目を保存しました。", error: false });
    } catch (failure) {
      setDeleteDialogOpen(false);
      const cancelled = failure instanceof DOMException && failure.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : failure instanceof Error ? failure.message : "保存できませんでした。", error: !cancelled });
    }
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
      if (!isSaving) void save({ type: "add", accountCode, accountName });
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
      </div>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSaving || !accountCode.trim() || !accountName.trim()}>登録</button>
      </div>
    </form>
    <StatusNotice {...notice} onDismiss={dismissNotice} />
    <ConfirmationDialog open={isDeleteDialogOpen} title="勘定科目を削除" message={deletingAccount ? `「${deletingAccount.accountCode} ${deletingAccount.accountName}」を削除しますか？` : ""}
      confirmLabel="削除する" busy={isSaving} onCancel={() => setDeleteDialogOpen(false)}
      onConfirm={() => { if (deletingAccount && !isSaving) void save({ type: "delete", id: deletingAccount.id }); }} />
    <div className="account-master-list" role="region" aria-label="勘定科目一覧" tabIndex={0}>
      <table className="account-master-table" aria-label="勘定科目一覧">
        <thead><tr><th scope="col">科目コード</th><th scope="col">科目名</th><th scope="col">操作</th></tr></thead>
        {accounts.length === 0 && <tbody><tr><td colSpan={3} className="page-description">勘定科目はまだ登録されていません。</td></tr></tbody>}
        {accounts.map(account => {
          const inUse = account.inUse || usedAccountIds.has(account.id);
          const draft = editing?.id === account.id ? editing : null;
          const editFormId = `account-edit-${account.id}`;
          return <tbody key={account.id}>
            <tr onKeyDown={event => {
              if (draft && event.key === "Escape") {
                event.preventDefault(); event.stopPropagation();
                if (!isSaving) cancelEditing();
              }
            }}>
              <td className="account-code">{draft
                ? <input autoFocus form={editFormId} name="accountCode" aria-label={`${account.accountName}の科目コード`} inputMode="numeric" autoComplete="off" value={draft.accountCode} disabled={isSaving} onChange={event => setEditing({ ...draft, accountCode: event.target.value })} />
                : account.accountCode ?? "未設定"}</td>
              <th scope="row" className="account-master-name">{draft
                ? <input form={editFormId} name="accountName" aria-label={`${account.accountName}の科目名`} autoComplete="off" value={draft.accountName} disabled={isSaving} onChange={event => setEditing({ ...draft, accountName: event.target.value })} />
                : account.accountName}</th>
              <td>{draft ? <form id={editFormId} className="form-actions" onSubmit={event => {
                event.preventDefault();
                if (!isSaving) void save({ type: "update", ...draft });
              }}>
                <button className="text-button" type="submit" disabled={isSaving || !draft.accountCode.trim() || !draft.accountName.trim()}>保存</button>
                <button className="text-button" type="button" disabled={isSaving} onClick={cancelEditing}>キャンセル</button>
              </form> : <div className="form-actions">
                <button ref={button => { if (button && focusAfterEdit.current === account.id) { button.focus({ preventScroll: true }); focusAfterEdit.current = null; } }} className="text-button" type="button" aria-label={`${account.accountName}を編集`} disabled={isSaving || editing !== null} onClick={() => { setEditing({ id: account.id, accountCode: account.accountCode ?? "", accountName: account.accountName }); setNotice({ message: "", error: false }); }}>編集</button>
                <button className="text-button" type="button" aria-label={`${account.accountName}を削除`} disabled={isSaving || inUse || editing !== null} title={inUse ? "この科目を使う施策や明細があるため削除できません" : undefined} onClick={() => { setDeletingAccount(account); setDeleteDialogOpen(true); dismissNotice(); }}>削除</button>
              </div>}</td>
            </tr>
          </tbody>;
        })}
      </table>
    </div>
  </main>;
}
