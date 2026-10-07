import { useState } from "react";
import { dataTables, screenData } from "./screenDataModel";
import "./ScreenDataMap.css";

export function ScreenDataMap({ disabled }: { disabled: boolean }) {
  const [selected, setSelected] = useState("initiative-list");
  const [opened, setOpened] = useState<string | null>("initiatives");
  const screen = screenData.find(item => item.page === selected)!;
  const select = (page: string) => { setSelected(page); setOpened(null); };
  const follow = (reference: string) => {
    const name = reference.split(".")[0]!;
    setOpened(name);
    requestAnimationFrame(() => {
      const target = document.getElementById(`screen-data-${name}`);
      target?.querySelector<HTMLButtonElement>(".screen-data-table-heading")?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  };
  return <section className="screen-data-map" aria-label="画面とデータの対応図">
    <nav className="screen-data-screens" aria-label="データの対応を確認する画面">
      {screenData.map(item => <button type="button" key={item.page} aria-pressed={selected === item.page}
        disabled={disabled} onClick={() => select(item.page)}>{item.name}</button>)}
    </nav>
    <div className="screen-data-content" key={screen.page}>
      <div className="screen-data-interface">
        <span className="screen-data-caption">画面</span><h2>{screen.name}</h2>
        {screen.calculated.length > 0 && <div className="screen-data-calculated"><h3>表示と計算</h3>
          {screen.calculated.map(text => <p key={text}>{text}</p>)}
        </div>}
      </div>
      <div className="screen-data-tables" aria-label={`${screen.name}を構成するテーブル`}>
        <span className="screen-data-caption">保存テーブルと表示項目</span>
        {screen.tables.length === 0 && <p className="screen-data-empty">保存テーブルなし · アプリの固定定義</p>}
        {screen.tables.map(usage => {
          const table = dataTables.find(item => item.name === usage.table)!;
          return <article id={`screen-data-${table.name}`} className="screen-data-table" key={table.name}>
            <button className="screen-data-table-heading" type="button" aria-expanded={opened === table.name}
              aria-controls={`screen-data-columns-${table.name}`} onClick={() => setOpened(opened === table.name ? null : table.name)}>
              <span><strong>{table.label}</strong><code>{table.name}</code></span><span aria-hidden="true">{opened === table.name ? "−" : "＋"}</span>
            </button>
            <p>{usage.purpose}</p>
            <ul className="screen-data-used-fields" aria-label="画面で使う保存項目">
              {usage.fields.map(name => <li key={name}><span>{table.columns.find(column => column.name === name)!.label}</span><code>{name}</code></li>)}
            </ul>
            <div id={`screen-data-columns-${table.name}`} hidden={opened !== table.name} className="screen-data-columns">
              <h3>テーブルの全項目と参照先</h3>
              <table><thead><tr><th>項目</th><th>保存名</th><th>参照先</th></tr></thead><tbody>
                {table.columns.map(column => <tr key={column.name}><td>{column.label}</td><td><code>{column.name}</code></td>
                  <td>{column.reference ? screen.tables.some(item => item.table === column.reference!.split(".")[0])
                    ? <button type="button" className="screen-data-reference" onClick={() => follow(column.reference!)}>{column.reference}</button>
                    : <code>{column.reference}</code> : "—"}</td></tr>)}
              </tbody></table>
            </div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
