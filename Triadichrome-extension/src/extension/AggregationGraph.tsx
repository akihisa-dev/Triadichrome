import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { type Account } from "../core/accountMaster";
import { type Aggregation, type AggregationMember } from "../core/aggregations";
import { aggregationNodeWidth, layoutAggregationGraph } from "../core/aggregationGraph";
import { useGraphViewport } from "./useGraphViewport";

type Item = Pick<AggregationMember, "kind" | "id">;
type Props = {
  accounts: Account[]; groups: Aggregation[]; disabled: boolean; editingId: number | null;
  renderEditor: (group: Aggregation) => ReactNode;
  onEdit: (group: Aggregation) => void; onDelete: (group: Aggregation) => void;
  onMove: (item: Item, parentId: number | null, sign: 1 | -1) => Promise<boolean>;
};
const keyOf = (item: Item) => `${item.kind}:${item.id}`;

export function AggregationGraph({ accounts, groups, disabled, editingId, renderEditor, onEdit, onDelete, onMove }: Props) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [dragging, setDragging] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [hoveredSign, setHoveredSign] = useState<number | null>(null);
  const [heights, setHeights] = useState(new Map<number, number>());
  const [availableWidth, setAvailableWidth] = useState(640);
  const [trayOpen, setTrayOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<number, HTMLElement>());
  const surface = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const gesture = useRef<{ item: Item; x: number; y: number; startX: number; startY: number; active: boolean; element: HTMLButtonElement; pointerId: number } | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const blocked = disabled || editingId !== null;
  const owners = useMemo(() => new Map(groups.flatMap(group => group.members.map(member => [keyOf(member), group.id] as const))), [groups]);
  const unassigned = accounts.filter(account => !owners.has(`account:${account.id}`));
  const labels = useMemo(() => new Map<string, string>([
    ...accounts.map(account => [`account:${account.id}`, `${account.accountCode ?? "未設定"} ${account.accountName}`] as const),
    ...groups.map(group => [`group:${group.id}`, group.name] as const),
  ]), [accounts, groups]);
  const forbidden = useMemo(() => {
    const ids = new Set<number>();
    if (selected?.kind === "group") {
      const byId = new Map(groups.map(group => [group.id, group]));
      const queue = [selected.id];
      for (let index = 0; index < queue.length; index++) {
        const id = queue[index]!;
        if (ids.has(id)) continue;
        ids.add(id);
        queue.push(...(byId.get(id)?.members.filter(member => member.kind === "group").map(member => member.id) ?? []));
      }
    }
    return ids;
  }, [groups, selected]);
  const layout = useMemo(() => layoutAggregationGraph(groups, heights, availableWidth), [groups, heights, availableWidth]);
  const navigation = useGraphViewport(viewport, layout.width, layout.height);
  const positions = new Map(layout.nodes.map(node => [node.id, node]));
  const edges = groups.flatMap(parent => parent.members.filter(member => member.kind === "group").map(member => {
    const child = positions.get(member.id)!;
    const result = positions.get(parent.id)!;
    const x = child.x + aggregationNodeWidth / 2;
    const parentX = result.x + aggregationNodeWidth / 2;
    return { member, parent, x, y: child.y - 24, path: `M ${x} ${child.y} V ${child.y - 52} H ${parentX} V ${result.y + result.height + 2}` };
  }));
  useLayoutEffect(() => {
    const measure = () => {
      setAvailableWidth(viewport.current?.clientWidth ?? 640);
      setHeights(previous => {
        const next = new Map([...nodes.current].map(([id, element]) => [id, element.offsetHeight]));
        return next.size === previous.size && [...next].every(([id, height]) => previous.get(id) === height) ? previous : next;
      });
    };
    const observer = new ResizeObserver(measure);
    nodes.current.forEach(element => observer.observe(element));
    if (viewport.current) observer.observe(viewport.current);
    measure();
    return () => observer.disconnect();
  }, [groups, editingId]);
  useEffect(() => () => { if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); }, []);
  const clear = () => {
    const current = gesture.current;
    if (current?.active) suppressClick.current = true;
    gesture.current = null;
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    setSelected(null); setDragging(false); setHovered(null); setHoveredSign(null);
  };
  const move = async (parentId: number | null, sign: 1 | -1, item = selected) => {
    if (!item || blocked || moving.current || (item === selected && parentId !== null && forbidden.has(parentId))) return;
    const current = groups.find(group => group.id === parentId)?.members.find(member => keyOf(member) === keyOf(item));
    if (current?.sign === sign || (parentId === null && !owners.has(keyOf(item)))) { clear(); return; }
    moving.current = true;
    const saved = await onMove(item, parentId, sign);
    moving.current = false;
    if (saved) {
      clear();
      requestAnimationFrame(() => surface.current?.querySelector<HTMLButtonElement>(`[data-move-key="${keyOf(item)}"]`)?.focus({ preventScroll: true }));
    }
  };
  const hoverAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    const hit = element?.closest<HTMLElement>("[data-group-id]");
    setHovered(hit ? Number(hit.dataset.groupId) : null);
    const drop = element?.closest<HTMLElement>("[data-drop-sign]");
    setHoveredSign(drop ? Number(drop.dataset.dropSign) : null);
  };
  const autoPan = () => {
    const current = gesture.current;
    if (!current?.active || !viewport.current) return;
    const rect = viewport.current.getBoundingClientRect();
    if (current.x >= rect.left && current.x <= rect.right && current.y >= rect.top && current.y <= rect.bottom) {
      const speed = (position: number, start: number, end: number) => position < start + 32 ? -10 : position > end - 32 ? 10 : 0;
      navigation.panBy(-speed(current.x, rect.left, rect.right), -speed(current.y, rect.top, rect.bottom));
      hoverAt(current.x, current.y);
    }
    scrollFrame.current = requestAnimationFrame(autoPan);
  };
  const grip = (item: Item) => <button type="button" className="graph-grip" data-move-key={keyOf(item)}
    aria-label={`${labels.get(keyOf(item))}の所属を移動`} aria-pressed={selected !== null && keyOf(selected) === keyOf(item)}
    title="ドラッグ、または選択して移動先を押す" disabled={blocked}
    onClick={event => {
      if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
      suppressClick.current = false;
      if (selected && keyOf(selected) === keyOf(item)) clear(); else { setSelected(item); setDragging(false); }
    }}
    onPointerDown={event => {
      if (blocked || event.button !== 0) return;
      suppressClick.current = false;
      gesture.current = { item, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, element: event.currentTarget, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 5) return;
      if (!current.active) { current.active = true; setSelected(current.item); setDragging(true); scrollFrame.current = requestAnimationFrame(autoPan); }
      event.preventDefault();
      setPoint({ x: current.x, y: current.y }); hoverAt(current.x, current.y);
    }} onPointerUp={event => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (!current.active) { gesture.current = null; return; }
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop-parent]");
      suppressClick.current = true;
      clear();
      if (target && target.getAttribute("disabled") === null) void move(target.dataset.dropParent === "none" ? null : Number(target.dataset.dropParent), Number(target.dataset.dropSign ?? 1) as 1 | -1, current.item);
    }} onPointerCancel={clear}>⠿</button>;
  const drops = (group: Aggregation) => <div className="graph-drop-targets">
    {([1, -1] as const).map(sign => <button type="button" key={sign} className={`graph-drop-target${dragging && hovered === group.id && hoveredSign === sign ? " is-over" : ""}`}
      data-drop-parent={group.id} data-drop-sign={sign}
      aria-label={`${group.name}に${sign === 1 ? "加算" : "減算"}として移動`} disabled={blocked || forbidden.has(group.id)}
      onClick={() => void move(group.id, sign)}>
      <span aria-hidden="true">{sign === 1 ? "＋" : "−"}</span>{sign === 1 ? "加算" : "減算"}
    </button>)}
  </div>;
  const accountRow = (account: Account, parent: Aggregation | null) => {
    const member = parent?.members.find(item => item.kind === "account" && item.id === account.id);
    const item: Item = { kind: "account", id: account.id };
    return <div className={`graph-account${dragging && selected?.kind === "account" && selected.id === account.id ? " is-dragging" : ""}`} key={account.id}>
      {grip(item)}
      {member && <button type="button" className="graph-sign" disabled={blocked} title="加算・減算を切り替え"
        aria-label={`${account.accountName}の${member.sign === 1 ? "加算を減算" : "減算を加算"}に変更`}
        onClick={() => void move(parent!.id, member.sign === 1 ? -1 : 1, item)}>{member.sign === 1 ? "＋" : "−"}</button>}
      <span className="graph-account-label"><span className="graph-account-code">{account.accountCode ?? "未設定"}</span>{account.accountName}</span>
    </div>;
  };
  return <div className="aggregation-workspace" ref={surface} onKeyDown={event => {
    if (event.key === "Escape" && selected) { event.preventDefault(); event.stopPropagation(); clear(); }
  }}>
    <div className="graph-map">
    <div ref={viewport} className={`aggregation-viewport${navigation.panning ? " is-panning" : ""}`} role="region" aria-label="集計の関係図" aria-describedby="graph-navigation-help" tabIndex={0} {...navigation.handlers}>
      <div className="aggregation-canvas" style={{ width: layout.width, height: layout.height, transform: `translate(${navigation.view.x}px, ${navigation.view.y}px) scale(${navigation.view.scale})` }}>
        <svg className="aggregation-connections" width={layout.width} height={layout.height} aria-hidden="true">
          <defs><marker id="aggregation-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="currentColor" /></marker></defs>
          {edges.map(edge => <path key={edge.member.id} d={edge.path} markerEnd="url(#aggregation-arrow)" />)}
        </svg>
        {edges.map(({ member, parent, x, y }) => <button key={member.id} type="button" className="graph-edge-sign" disabled={blocked}
          style={{ left: x, top: y }}
          aria-label={`${labels.get(keyOf(member))} → ${parent.name}：${member.sign === 1 ? "加算" : "減算"}。押すと切り替え`}
          onClick={() => void move(parent.id, member.sign === 1 ? -1 : 1, member)}>{member.sign === 1 ? "＋" : "−"}</button>)}
        {groups.map(group => {
          const position = positions.get(group.id)!;
          const editing = editingId === group.id;
          const showDrops = selected !== null && !blocked;
          const ownedAccounts = accounts.filter(account => owners.get(`account:${account.id}`) === group.id);
          return <section key={group.id} data-group-id={group.id} aria-label={group.name} className={`aggregation-node${editing ? " is-editing" : ""}${showDrops ? " is-target" : ""}${dragging && hovered !== group.id ? " is-away" : ""}${selected?.kind === "group" && selected.id === group.id ? " is-selected" : ""}`}
            ref={element => { if (element) nodes.current.set(group.id, element); else nodes.current.delete(group.id); }}
            style={{ left: position.x, top: position.y, width: aggregationNodeWidth }}>
            <header className="aggregation-node-header">
              {grip({ kind: "group", id: group.id })}
              <button className="graph-group-name" type="button" aria-label={`${group.name}を編集`} disabled={blocked} onClick={() => { clear(); onEdit(group); }}>{group.name}</button>
              {group.required && <span className="required-marker">必須</span>}
            </header>
            {editing ? renderEditor(group) : <>
              {ownedAccounts.map(account => accountRow(account, group))}
              {group.members.length === 0 && <p className="graph-empty">科目・集計をここへ</p>}
            </>}
            {!editing && <button className="graph-delete" type="button" aria-label={`${group.name}を削除`} title="集計を削除"
              disabled={blocked || group.required !== null || group.members.length > 0 || owners.has(`group:${group.id}`)} onClick={() => onDelete(group)}>×</button>}
            {showDrops && drops(group)}
            {showDrops && forbidden.has(group.id) && <span className="graph-forbidden">自分自身・配下には移動できません</span>}
          </section>;
        })}
      </div>
    </div>
    <p id="graph-navigation-help" className="graph-accessible-help">背景をドラッグで移動、ホイール・ピンチで拡大縮小。科目・集計のハンドルをドラッグし、移動先の加算・減算に入れます。</p>
    <div className="graph-view-controls" role="group" aria-label="関係図の表示操作">
      <button type="button" aria-label="関係図を縮小" title="縮小" disabled={navigation.view.scale <= navigation.minScale} onClick={() => navigation.zoom(0.8)}>−</button>
      <button type="button" className="graph-zoom-level" aria-label="100%で表示" title="100%で表示" onClick={() => navigation.zoom(1 / navigation.view.scale)}>{Math.round(navigation.view.scale * 100)}%</button>
      <button type="button" aria-label="関係図を拡大" title="拡大" disabled={navigation.view.scale >= navigation.maxScale} onClick={() => navigation.zoom(1.25)}>＋</button>
      <button type="button" className="graph-fit" onClick={navigation.fit}>全体表示</button>
    </div>
    </div>
    <section hidden={editingId !== null} className={`graph-unassigned${selected && !blocked ? " is-target" : ""}`} aria-label="未所属" data-drop-parent="none">
      <div className="graph-unassigned-heading"><h2><button type="button" className="text-button" aria-expanded={trayOpen} aria-controls="graph-unassigned-accounts" onClick={() => setTrayOpen(!trayOpen)}>未所属 <span>{unassigned.length}</span> <span aria-hidden="true">{trayOpen ? "▾" : "▴"}</span></button></h2>
        {selected && !blocked && <button type="button" className="text-button" aria-label="ここへ移動して所属を外す" onClick={() => void move(null, 1)} disabled={!owners.has(keyOf(selected))}>所属を外す</button>}
      </div>
      <div id="graph-unassigned-accounts" hidden={!trayOpen} className="graph-unassigned-accounts">
        {unassigned.map(account => accountRow(account, null))}
        {unassigned.length === 0 && <p className="graph-empty">未所属の科目はありません</p>}
      </div>
    </section>
    <div className="graph-accessible-help" role="status" aria-live="polite">{selected ? `「${labels.get(keyOf(selected))}」の移動先で、加算・減算を選択` : ""}</div>
    {selected && <button className="text-button graph-cancel-move" type="button" onClick={clear}>移動をキャンセル</button>}
    {dragging && selected && createPortal(<div className="graph-drag-preview" style={{ left: point.x + 12, top: point.y + 12 }} aria-hidden="true">{labels.get(keyOf(selected))}</div>, document.body)}
  </div>;
}
