import { useLayoutEffect, useState } from "react";
import { initiativeMonths, type PlanContents } from "../core/initiatives";
import { isValidAmount } from "../core/amounts";
import type { PreviousInput } from "../core/kindAmounts";
import { useAutoSave, type AutoSaveProps } from "./useAutoSave";
import { AutoSaveStatus } from "./AutoSaveStatus";

type Props = AutoSaveProps & { contents: PlanContents; onSave: (input: PreviousInput) => Promise<void> };
export function PreviousInputPage({ contents, onSave, onPendingChange, onPrepareSave }: Props) {
  const [industryId, setIndustry] = useState<number | null>(null);
  const [departmentId, setDepartment] = useState<number | null>(null);
  const autoSave = useAutoSave(onSave, onPendingChange);
  const { controller, draft } = autoSave;
  useLayoutEffect(() => {
    if (industryId === null || departmentId === null || controller.getSnapshot().draft) return;
    controller.begin({ industryId, departmentId, rows: contents.accounts.map(account => ({ accountId: account.id,
      amounts: Object.fromEntries(initiativeMonths.map(month => [month, contents.previousAmounts.find(amount => amount.accountId === account.id && amount.industryId === industryId && amount.departmentId === departmentId && amount.month === month)?.amount ?? "0"])) })) });
  }, [controller, contents, industryId, departmentId]);
  return <main className="initiative-entry-page" aria-labelledby="previous-input-title" onCompositionStart={() => controller.pause()} onCompositionEnd={() => controller.resume()}>
    <h1 id="previous-input-title">前年入力</h1>
    <div className="initiative-classification-row">
      <div className="initiative-field"><label>年度</label><output>{contents.fiscalYear}年度の前年</output></div>
      <div className="initiative-field"><label htmlFor="previous-industry">業種名</label><select id="previous-industry" required disabled={autoSave.pending} value={industryId ?? ""} onChange={event => { controller.end(); setIndustry(event.target.value ? Number(event.target.value) : null); }}>
        <option value="">業種名を選択</option>{contents.industries.map(item => <option key={item.id} value={item.id}>{item.industryName}</option>)}
      </select></div>
      <div className="initiative-field"><label htmlFor="previous-department">部署名</label><select id="previous-department" required disabled={autoSave.pending} value={departmentId ?? ""} onChange={event => { controller.end(); setDepartment(event.target.value ? Number(event.target.value) : null); }}>
        <option value="">部署名を選択</option>{contents.departments.map(item => <option key={item.id} value={item.id}>{item.departmentName}</option>)}
      </select></div>
    </div>
    <AutoSaveStatus state={autoSave} controller={controller} onPrepareSave={onPrepareSave} />
    <span className="field-hint">単位：千円（小数点以下3桁まで）</span>
    {draft && <div className="initiative-amount-table-container" role="region" aria-label="前年の月別金額" tabIndex={0}><table className="initiative-amount-table">
      <thead><tr><th scope="col">勘定科目</th>{initiativeMonths.map(month => <th scope="col" key={month}>{month}月</th>)}</tr></thead>
      <tbody>{draft.rows.map((row, index) => {
        const account = contents.accounts.find(account => account.id === row.accountId)!;
        return <tr key={row.accountId}><th scope="row">{account.accountCode} {account.accountName}</th>{initiativeMonths.map(month => <td key={month}><input type="number" step="0.001" inputMode="decimal" aria-label={`${account.accountName} ${month}月の前年金額`} value={row.amounts[month] ?? "0"}
          ref={input => { if (input) input.setCustomValidity(input.value === "" || isValidAmount(input.value) ? "" : "金額は千円単位・小数点以下3桁までで入力してください。"); }}
          onChange={event => controller.change({ ...draft, invalidNumbers: [...event.currentTarget.closest("main")!.querySelectorAll("input")].some(input => input.validity.badInput), rows: draft.rows.map((current, position) => position === index ? { ...current, amounts: { ...current.amounts, [month]: event.target.value } } : current) })} /></td>)}</tr>;
      })}</tbody>
    </table></div>}
  </main>;
}
