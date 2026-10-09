import { flushSync } from "react-dom";
import type { Account } from "../core/domain/accountMaster";
/** Keep the native select and all keyboard behavior, materializing choices while it is in use. */
export function AccountRowSelect({ accounts, account, value, label, disabled, active, onActivate, onDeactivate, onChange }: {
  accounts: Account[]; account: Account | undefined; value: number | null; label: string;
  disabled: boolean; active: boolean; onActivate: () => void; onDeactivate: () => void; onChange: (value: number | null) => void;
}) {
  const options = active ? accounts : account ? [account] : [];
  return <select aria-label={label} value={value ?? ""} disabled={disabled}
    onPointerDown={() => flushSync(onActivate)} onKeyDown={() => { if (!active) flushSync(onActivate); }}
    onFocus={onActivate} onBlur={event => { if (event.relatedTarget) onDeactivate(); }}
    onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
    <option value="">科目を選択</option>
    {options.map(item => <option key={item.id} value={item.id}>{item.accountCode ?? "未設定"} {item.accountName}</option>)}
  </select>;
}
