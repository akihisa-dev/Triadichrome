import { useState } from "react";
import type { DataHistoryEntry, HistoryDeletion } from "../core/storage/dataHistory";
import { ConfirmationDialog } from "./ConfirmationDialog";
import "./DataHistoryPage.css";

const dateFormat = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hourCycle: "h23" });
export const historyDate = (timestamp: string) => dateFormat.format(new Date(timestamp));

export function DataHistoryPage({ entries, busy, error, onPreview, onDelete, onRetry }: {
  entries: DataHistoryEntry[]; busy: boolean; error: string;
  onPreview: (entry: DataHistoryEntry) => Promise<void>;
  onDelete: (deletion: HistoryDeletion) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [cutoff, setCutoff] = useState("");
  const [deletion, setDeletion] = useState<HistoryDeletion | null>(null);
  const [failure, setFailure] = useState("");
  const [working, setWorking] = useState(false);
  const locked = busy || working;
  const ids = selected.filter(id => entries.some(entry => entry.id === id));
  const before = cutoff && Number.isFinite(new Date(cutoff).getTime()) ? new Date(cutoff).toISOString() : null;
  const older = before ? entries.filter(entry => entry.recordedAt < before).length : 0;
  const count = deletion ? "ids" in deletion ? deletion.ids.length : entries.filter(entry => entry.recordedAt < deletion.before).length : 0;
  const perform = async (operation: () => Promise<void>) => {
    if (locked) return;
    setWorking(true); setFailure("");
    try { await operation(); }
    catch (reason) { setFailure(reason instanceof Error ? reason.message : "履歴の操作に失敗しました。"); }
    finally { setWorking(false); }
  };
  return <main className="data-history-page" aria-labelledby="data-history-title">
    <h1 id="data-history-title">履歴</h1>
    <div className="data-history-actions">
      <button className="secondary-button" type="button" disabled={locked || !ids.length} onClick={() => setDeletion({ ids })}>選択した履歴を削除</button>
      <label htmlFor="history-cutoff">指定日時より前を削除</label>
      <input id="history-cutoff" type="datetime-local" step="1" value={cutoff} disabled={locked} onChange={event => setCutoff(event.target.value)} />
      <button className="secondary-button" type="button" disabled={locked || !older || !before} onClick={() => { if (before) setDeletion({ before }); }}>一括削除</button>
    </div>
    {(failure || error) && <div className="data-history-error" role="alert"><p>{failure || error}</p><button className="text-button" type="button" disabled={locked} onClick={() => void perform(onRetry)}>保存を再試行</button></div>}
    <div className="data-history-list" role="region" aria-label="データの履歴" tabIndex={0}>
      <table><thead><tr>
        <th scope="col"><input type="checkbox" aria-label="すべての履歴を選択" disabled={locked || !entries.length} checked={entries.length > 0 && ids.length === entries.length} onChange={event => setSelected(event.target.checked ? entries.map(entry => entry.id) : [])} /></th>
        <th scope="col">記録日時</th>
      </tr></thead><tbody>{entries.map(entry => <tr key={entry.id}>
        <td><input type="checkbox" aria-label={`${historyDate(entry.recordedAt)}の履歴を選択`} disabled={locked} checked={ids.includes(entry.id)} onChange={event => setSelected(current => event.target.checked ? [...current, entry.id] : current.filter(id => id !== entry.id))} /></td>
        <td><button className="text-button history-date" type="button" disabled={locked} onClick={() => void perform(() => onPreview(entry))}><time dateTime={entry.recordedAt}>{historyDate(entry.recordedAt)}</time></button></td>
      </tr>)}</tbody></table>
      {!entries.length && <p className="page-description">履歴はまだありません。</p>}
    </div>
    <ConfirmationDialog open={deletion !== null} title="履歴を削除" message={failure || `${count}件の履歴を削除しますか？ 削除した履歴には戻れません。現在の計画データは変わりません。`} confirmLabel="削除する" busy={locked}
      onCancel={() => setDeletion(null)} onConfirm={() => { if (deletion) void perform(async () => { await onDelete(deletion); setDeletion(null); setSelected([]); }); }} />
  </main>;
}
