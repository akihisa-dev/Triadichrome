import { processPreviousWorkbook } from "./previousWorkbookProcessing";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import type { PlanContents } from "../core/domain/plan";
import type { KindSelections, PlanChange, PreviousPatch } from "../core/domain/kinds";
import { useHistoryReadOnly } from "./HistoryReadOnly";
import { KindSelectionSlots } from "./KindSelectionSlots";
import { ChoiceChips } from "./ChoiceChips";
import { StatusNotice } from "./StatusNotice";
import { useSavedOperationRevision } from "./SavedOperationRevision";
import { createReportWorkbook, createPreviousWorkbookBytes, serializeWorkbook, type ExportTable, type PreviousPair } from "../core/spreadsheets/workbook";
import { previousWorkbookLimits } from "../core/spreadsheets/previousWorkbookBoundary";
import "./SpreadsheetIOPage.css";

const tableNames: Record<ExportTable, string> = { "cost-table": "総原価表", "expansion-table": "展開表", "initiative-list": "施策一覧" };
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Props = { contents: PlanContents; busy: boolean; onChangePlan: (change: PlanChange) => Promise<void>; onPrepareSave: () => Promise<void>; onPendingChange: (pending: boolean) => void };
export function SpreadsheetIOPage({ contents, busy, onChangePlan, onPrepareSave, onPendingChange }: Props) {
  const readOnly = useHistoryReadOnly();
  const [tables, setTables] = useState<ExportTable[]>(["cost-table", "expansion-table", "initiative-list"]);
  const [selections, setSelections] = useState<KindSelections>(() => ({ "cost-table": [1], "expansion-table": [1], "initiative-list": [2] }));
  const [industries, setIndustries] = useState<number[]>([]);
  const [departments, setDepartments] = useState<number[]>([]);
  const [pairs, setPairs] = useState<PreviousPair[]>([]);
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const previewPending = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const revision = useSavedOperationRevision();
  const dismiss = useCallback(() => { setNotice(""); setError(false); }, []);
  useEffect(dismiss, [revision, dismiss]);
  const [patches, setPatches] = useState<PreviousPatch[] | null>(null);
  const [retry, setRetry] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const disabled = busy || working || patches !== null;
  const operation = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setWorking(true); onPendingChange(true); setNotice(""); setError(false);
    try { await action(); } catch (failure) { setNotice(failure instanceof Error ? failure.message : "処理できませんでした。"); setError(true); }
    finally { running.current = false; setWorking(false); onPendingChange(previewPending.current); }
  };
  const importFiles = async (files: File[]) => {
    if (!files.length || disabled || readOnly) return;
    await operation(async () => {
      if (files.length !== 1) throw new Error("取り込みファイルは一つずつ選択してください。");
      const file = files[0]!;
      if (!/\.xlsx$/i.test(file.name)) throw new Error("前年入力フォーマットのExcelファイル（.xlsx）を選択してください。");
      if (file.size > previousWorkbookLimits.compressedBytes) throw new Error("取り込みファイルは20MB以下にしてください。");
      const changes = await processPreviousWorkbook(new Uint8Array(await file.arrayBuffer()), contents);
      if (!changes.length) { setNotice("変更する金額がありません。"); return; }
      previewPending.current = true; setPatches(changes); setRetry(false);
    });
  };
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled || readOnly ? "none" : "copy";
    setDragging(!disabled && !readOnly);
  };
  return <main className="spreadsheet-io-page" aria-labelledby="spreadsheet-io-title">
    <h1 id="spreadsheet-io-title">入出力</h1>
    <section className="io-panel" aria-labelledby="io-export-title">
      <div className="io-heading"><h2 id="io-export-title">表の出力</h2><span className="field-hint">Excel · 三表と計算元 · 千円</span></div>
      {(Object.keys(tableNames) as ExportTable[]).map(table => <div className="io-table-option" key={table}>
        <label className="io-check"><input type="checkbox" checked={tables.includes(table)} disabled={disabled} onChange={event => setTables(current => event.target.checked ? [...current, table] : current.filter(t => t !== table))} />{tableNames[table]}</label>
        {tables.includes(table) && <div className="io-table-conditions">
          <KindSelectionSlots screen={table} selected={selections[table]} disabled={disabled} onChange={selected => setSelections(current => ({ ...current, [table]: selected }))} />
          {table === "cost-table" && <div className="io-classifications">
            <ChoiceChips id="export-industry" label="業種名" value={industries} emptyLabel="全業種の合計" options={contents.industries.map(i => ({ id: i.id, name: i.industryName }))} disabled={disabled} onChange={setIndustries} />
            <ChoiceChips id="export-department" label="部署名" value={departments} emptyLabel="全部署の合計" options={contents.departments.map(d => ({ id: d.id, name: d.departmentName }))} disabled={disabled} onChange={setDepartments} />
          </div>}
        </div>}
      </div>)}
      <button type="button" className="primary-button" disabled={disabled || !tables.length} onClick={() => { void operation(async () => {
        const wb = createReportWorkbook(contents, { tables, selections, costFilter: { industries: industries.length ? industries : null, departments: departments.length ? departments : null } });
        download(await serializeWorkbook(wb), `${contents.fiscalYear}年度_三表.xlsx`); setNotice("表を出力しました。");
      }); }}>選んだ表を出力</button>
    </section>
    <section className={`io-panel io-previous-panel${dragging && !disabled && !readOnly ? " is-drag-active" : ""}`} aria-labelledby="io-previous-title"
      onDragEnter={drag} onDragOver={drag}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={event => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault(); setDragging(false);
        void importFiles(Array.from(event.dataTransfer.files));
      }}>
      <div className="io-heading"><h2 id="io-previous-title">{dragging && !disabled && !readOnly ? "ここにドロップして取り込む" : "前年入力"}</h2><span className="field-hint">千円 · 小数点以下3桁まで</span></div>
      <div className="io-pair-list" role="group" aria-label="フォーマットに含める業種・部署">
        {contents.industries.map(i => <fieldset key={i.id}><legend>{i.industryName}</legend>{contents.departments.map(d => {
          const checked = pairs.some(p => p.industryId === i.id && p.departmentId === d.id);
          return <label className="io-check" key={d.id}><input type="checkbox" aria-label={`${i.industryName}・${d.departmentName}`} checked={checked} disabled={disabled} onChange={event => setPairs(current => event.target.checked ? [...current, { industryId: i.id, departmentId: d.id }] : current.filter(p => p.industryId !== i.id || p.departmentId !== d.id))} />{d.departmentName}</label>;
        })}</fieldset>)}
      </div>
      <div className="form-actions">
        <button type="button" className="secondary-button" disabled={disabled || !pairs.length} onClick={() => { void operation(async () => {
          download(await createPreviousWorkbookBytes(contents, pairs), `${contents.fiscalYear}年度_前年入力.xlsx`); setNotice("前年入力フォーマットを出力しました。");
        }); }}>フォーマットを出力</button>
        <button type="button" className="primary-button" disabled={disabled || readOnly} onClick={() => input.current?.click()}>フォーマットを取り込む</button>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importFiles(files); }} />
      </div>
      {patches && <div className="io-import-preview" role="region" aria-label="前年金額の変更確認">
        <h3>変更内容 · {patches.length}件</h3>
        <div className="io-preview-table"><table><thead><tr>{["業種", "部署", "科目", "月", "変更前", "変更後"].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{patches.map(p => <tr key={`${p.industryId}:${p.departmentId}:${p.accountId}:${p.month}`}>
            <td>{contents.industries.find(i => i.id === p.industryId)?.industryName}</td><td>{contents.departments.find(d => d.id === p.departmentId)?.departmentName}</td><td>{contents.accounts.find(a => a.id === p.accountId)?.accountName}</td><td>{p.month}月</td><td>{p.before}</td><td>{p.after}</td>
          </tr>)}</tbody></table></div>
        <div className="form-actions"><button type="button" className="secondary-button" disabled={working || busy} onClick={() => { previewPending.current = false; onPendingChange(false); setPatches(null); setRetry(false); setNotice(""); }}>キャンセル</button>
          <button type="button" className="primary-button" disabled={working || busy || readOnly} onClick={() => { void operation(async () => {
            try { await onPrepareSave(); await onChangePlan({ type: "previous-import", patches }); previewPending.current = false; setPatches(null); setRetry(false); setNotice("前年金額を取り込みました。"); }
            catch (failure) { setRetry(true); throw failure; }
          }); }}>{retry ? "保存を再試行して取り込む" : "確認した内容を取り込む"}</button></div>
      </div>}
    </section>
    <StatusNotice message={working ? "処理中…" : notice} error={error} {...(working ? {} : { onDismiss: dismiss })} />
  </main>;
}
