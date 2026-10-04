import { useEffect, useRef, useState } from "react";
import { type Account, type AccountChange } from "../core/accountMaster";
import { AnimatedHeight } from "./AnimatedHeight";
import { FadeSwap } from "./FadeSwap";

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
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  useEffect(() => {
    if (!isSaving && focusAfterSave.current) {
      focusAfterSave.current = false;
      input.current?.focus();
    }
  }, [isSaving]);
  const save = async (change: AccountChange) => {
    setNotice({ message: "", error: false });
    try {
      await onChange(change);
      if (change.type !== "delete" || change.id === editingId) {
        setAccountCode("");
        setAccountName("");
        setEditingId(null);
      }
      setDeletingId(null);
      setNotice({ message: change.type === "delete" ? "勘定科目を削除しました。" : "勘定科目を保存しました。", error: false });
      focusAfterSave.current = true;
    } catch (failure) {
      const cancelled = failure instanceof DOMException && failure.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : failure instanceof Error ? failure.message : "保存できませんでした。", error: !cancelled });
    }
  };

  return <main className="master-page" aria-labelledby="account-master-title" aria-busy={isSaving}>
    <button className="text-button master-back" type="button" disabled={isSaving} onClick={onBack}>← マスタへ戻る</button>
    <h1 id="account-master-title">勘定科目マスタ</h1>
    <p className="page-description">この計画で使う勘定科目を管理します。変更は計画ファイルに保存されます。</p>
    <form className="account-master-form" onSubmit={event => {
      event.preventDefault();
      if (!isSaving) void save(editingId === null ? { type: "add", accountCode, accountName } : { type: "update", id: editingId, accountCode, accountName });
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
        <button className="primary-button" type="submit" disabled={isSaving || !accountCode.trim() || !accountName.trim()}>{isSaving ? "保存中…" : editingId === null ? "登録" : "変更を保存"}</button>
        {editingId !== null && <button className="secondary-button" type="button" disabled={isSaving} onClick={() => { setEditingId(null); setAccountCode(""); setAccountName(""); }}>編集をやめる</button>}
      </div>
    </form>
    <AnimatedHeight><FadeSwap value={notice} className="motion-text">{value => value.message
      ? <p className="master-notice" role={value.error ? "alert" : "status"}>{value.message}</p> : null}</FadeSwap></AnimatedHeight>
    <section className="account-master-list" aria-labelledby="registered-accounts-title">
      <h2 id="registered-accounts-title">登録済みの勘定科目 <span>{accounts.length}件</span></h2>
      {accounts.length === 0 ? <p className="page-description">勘定科目はまだ登録されていません。</p> : <ul>
        {accounts.map(account => {
          const inUse = account.inUse || usedAccountIds.has(account.id);
          return <li key={account.id}>
            <div className="account-master-row">
              <span className="account-master-name"><span className="account-code">{account.accountCode ?? "未設定"}</span>{account.accountName}{inUse && <small>使用中</small>}</span>
              <div className="form-actions">
                <button className="text-button" type="button" aria-label={`${account.accountName}を編集`} disabled={isSaving} onClick={() => { setEditingId(account.id); setDeletingId(null); setAccountCode(account.accountCode ?? ""); setAccountName(account.accountName); input.current?.focus(); }}>編集</button>
                <button className="text-button" type="button" aria-label={`${account.accountName}を削除`} disabled={isSaving || inUse} title={inUse ? "使用中の勘定科目は削除できません" : undefined} onClick={() => setDeletingId(account.id)}>削除</button>
              </div>
            </div>
            <AnimatedHeight><FadeSwap value={deletingId === account.id}>{confirming => confirming ? <div className="account-delete-confirm">
              <p>「{account.accountCode} {account.accountName}」を削除しますか？</p>
              <div className="form-actions">
                <button className="secondary-button" type="button" disabled={isSaving} onClick={() => void save({ type: "delete", id: account.id })}>削除する</button>
                <button className="text-button" type="button" disabled={isSaving} onClick={() => setDeletingId(null)}>キャンセル</button>
              </div>
            </div> : null}</FadeSwap></AnimatedHeight>
          </li>;
        })}
      </ul>}
    </section>
  </main>;
}
