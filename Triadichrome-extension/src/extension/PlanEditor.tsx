import { useState } from "react";
import type { BudgetData, BudgetEdit, PlanLine } from "../core/budgetData";

export const formatAmount = (value: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
type Props = {
  data: BudgetData;
  disabled: boolean;
  onEdit: (edit: BudgetEdit) => Promise<boolean>;
  onDraftChange: (dirty: boolean) => void;
};
type Draft = { id?: number; initiativeId: string; accountId: string; month: string; cost: string; sales: string; note: string };

export function PlanEditor({ data, disabled, onEdit, onDraftChange }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initiative, setInitiative] = useState("");
  const [month, setMonth] = useState("");
  const ready = data.initiatives.length > 0 && data.accounts.length > 0 && data.months.length > 0;
  const lines = data.lines.filter((line) => (!initiative || line.initiativeId === Number(initiative)) && (!month || line.month === month));
  const start = (line?: PlanLine, copy = false) => {
    const next: Draft = {
      initiativeId: String(line?.initiativeId ?? data.initiatives[0]?.id ?? ""),
      accountId: String(line?.accountId ?? data.accounts[0]?.id ?? ""),
      month: line?.month ?? data.months[0] ?? "", cost: String(line?.cost ?? 0),
      sales: String(line?.sales ?? 0), note: line?.note ?? "",
    };
    if (line && !copy) next.id = line.id;
    setDraft(next);
    onDraftChange(true);
  };
  const change = (field: keyof Draft, value: string) => setDraft((current) => current ? { ...current, [field]: value } : current);
  const finish = () => { setDraft(null); onDraftChange(false); };
  return <section className="plan-editor" aria-label="計画明細の入力">
    <div className="plan-toolbar">
      <div><h2>計画明細</h2><p className="budget-hint">施策・勘定科目・年月ごとに入力します。金額は円単位（小数第2位まで）、利益は売上 − 原価です。</p></div>
      <button type="button" className="primary-button" disabled={disabled || !ready || draft !== null} onClick={() => start()}>明細を追加</button>
    </div>
    {!ready ? <p className="save-notice">「施策入力」で施策・勘定科目・年月をそれぞれ登録すると、計画を入力できます。</p> : null}
    {draft ? <form className="plan-form" onSubmit={(event) => {
      event.preventDefault();
      const edit: BudgetEdit = { type: "plan", line: {
        initiativeId: Number(draft.initiativeId), accountId: Number(draft.accountId),
        month: draft.month, cost: Number(draft.cost), sales: Number(draft.sales), note: draft.note,
      } };
      if (draft.id !== undefined) edit.id = draft.id;
      void onEdit(edit).then((applied) => { if (applied) finish(); });
    }}>
      <h3>{draft.id === undefined ? "新しい明細" : "明細を編集"}</h3>
      <fieldset disabled={disabled}>
        <div className="plan-fields">
          <label>施策<select autoFocus required value={draft.initiativeId} onChange={(event) => change("initiativeId", event.target.value)}>
            {data.initiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>勘定科目<select required value={draft.accountId} onChange={(event) => change("accountId", event.target.value)}>
            {data.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>年月<select required value={draft.month} onChange={(event) => change("month", event.target.value)}>
            {data.months.map((value) => <option key={value}>{value}</option>)}
          </select></label>
          <label>原価（円）<input required type="number" step="0.01" min="-1000000000000" max="1000000000000" value={draft.cost} onChange={(event) => change("cost", event.target.value)} /></label>
          <label>売上（円）<input required type="number" step="0.01" min="-1000000000000" max="1000000000000" value={draft.sales} onChange={(event) => change("sales", event.target.value)} /></label>
          <label>利益（円・自動計算）<output>{formatAmount(Number(draft.sales) - Number(draft.cost))}</output></label>
          <label className="plan-note">メモ<textarea rows={2} value={draft.note} onChange={(event) => change("note", event.target.value)} /></label>
        </div>
        <div className="plan-actions"><button className="primary-button" type="submit">{disabled ? "保存中…" : "計画を保存"}</button>
          <button type="button" onClick={() => { if (window.confirm("入力中の明細を取り消しますか？")) finish(); }}>取り消す</button></div>
      </fieldset>
      <p className="budget-hint">保存すると三表に反映します。複製時は施策・勘定科目・年月のいずれかを変更してください。</p>
    </form> : null}
    <div className="plan-filters">
      <label>施策で絞り込み<select value={initiative} onChange={(event) => setInitiative(event.target.value)}><option value="">すべての施策</option>
        {data.initiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>年月で絞り込み<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">すべての年月</option>
        {data.months.map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <span>{lines.length}件</span>
    </div>
    {!lines.length ? <p className="budget-empty">{data.lines.length ? "条件に合う明細はありません。" : "計画はまだありません。「明細を追加」から入力してください。"}</p> :
      <div className="budget-table-scroll" tabIndex={0} aria-label="計画明細の表">
        <table className="budget-table"><thead><tr>{["年月", "施策", "勘定科目", "原価（円）", "売上（円）", "利益（円）", "メモ", "操作"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{lines.map((line) => <tr key={line.id}>
            <td>{line.month}</td><td>{data.initiatives.find((item) => item.id === line.initiativeId)?.name}</td>
            <td>{data.accounts.find((item) => item.id === line.accountId)?.name}</td>
            <td className="numeric">{formatAmount(line.cost)}</td><td className="numeric">{formatAmount(line.sales)}</td>
            <td className="numeric">{formatAmount(line.sales - line.cost)}</td><td className="memo-cell">{line.note}</td>
            <td><div className="plan-actions">
              <button disabled={disabled || draft !== null} onClick={() => start(line)}>編集</button>
              <button disabled={disabled || draft !== null} onClick={() => start(line, true)}>複製</button>
              <button disabled={disabled || draft !== null} onClick={() => {
                if (window.confirm(`${line.month}・${data.initiatives.find((item) => item.id === line.initiativeId)?.name}・${data.accounts.find((item) => item.id === line.accountId)?.name}の明細を削除しますか？`)) void onEdit({ type: "deletePlan", id: line.id });
              }}>削除</button>
            </div></td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={3} scope="row">表示中の合計</th>
            <td className="numeric">{formatAmount(lines.reduce((sum, line) => sum + line.cost, 0))}</td>
            <td className="numeric">{formatAmount(lines.reduce((sum, line) => sum + line.sales, 0))}</td>
            <td className="numeric">{formatAmount(lines.reduce((sum, line) => sum + line.sales - line.cost, 0))}</td><td colSpan={2} />
          </tr></tfoot>
        </table>
      </div>}
  </section>;
}
