import { useLayoutEffect, useRef, useState, type RefObject, type PointerEvent } from "react";
import "./HomeRelations.css";
import { SidebarIcon } from "./SidebarIcon";
import { ScreenDataMap } from "./ScreenDataMap";
import { MechanismMap } from "./MechanismMap";
import { useHomeGraphMotion } from "./useHomeGraphMotion";
import { useRelationCamera, type RelationView } from "./useRelationCamera";
export type { RelationView } from "./useRelationCamera";

const nodes = [
  { page: "amount-item-master", name: "金額項目マスタ", icon: "master", x: 80, y: 530, master: true },
  { page: "account-type-master", name: "科目属性マスタ", icon: "master", x: 70, y: 120, master: true },
  { page: "account-master", name: "勘定科目マスタ", icon: "master", x: 260, y: 150, master: true },
  { page: "industry-master", name: "業種マスタ", icon: "master", x: 180, y: 290, master: true },
  { page: "department-master", name: "部署マスタ", icon: "master", x: 260, y: 430, master: true },
  { page: "period-master", name: "期間マスタ", icon: "master", x: 390, y: 530, master: true },
  { page: "expansion-category-master", name: "展開区分マスタ", icon: "master", x: 720, y: 620, master: true },
  { page: "expansion-master", name: "展開マスタ", icon: "master", x: 550, y: 560, master: true },
  { page: "kind-master", name: "種別マスタ", icon: "master", x: 370, y: 60, master: true },
  { page: "previous-input", name: "前年入力", icon: "previous", x: 750, y: 60, master: false },
  { page: "initiative-list", name: "施策一覧", icon: "list", x: 520, y: 308, master: false },
  { page: "cost-table", name: "総原価表", icon: "cost", x: 850, y: 220, master: false },
  { page: "expansion-table", name: "展開表", icon: "expansion", x: 950, y: 520, master: false },
] as const;

export type HomeDestination = typeof nodes[number]["page"];
const edges: { from: HomeDestination; to: HomeDestination; label: string }[] = [
  { from: "account-type-master", to: "amount-item-master", label: "金額項目の構成" },
  { from: "amount-item-master", to: "initiative-list", label: "売上・費用・利益を計算" },
  { from: "account-type-master", to: "account-master", label: "科目属性を選択" },
  { from: "previous-input", to: "cost-table", label: "前年の実額" },
  { from: "kind-master", to: "initiative-list", label: "種別ごとに入力" },
  { from: "account-master", to: "cost-table", label: "表示順・集計・加減" },
  { from: "account-master", to: "initiative-list", label: "科目を選択" },
  { from: "industry-master", to: "department-master", label: "所属業種を設定" },
  { from: "industry-master", to: "initiative-list", label: "部署の所属から業種を選択" },
  { from: "department-master", to: "initiative-list", label: "部署名を選択" },
  { from: "period-master", to: "initiative-list", label: "期間名を選択" },
  { from: "expansion-category-master", to: "expansion-master", label: "展開区分を割り当て" },
  { from: "expansion-category-master", to: "initiative-list", label: "展開の割当から区分を選択" },
  { from: "expansion-master", to: "initiative-list", label: "展開名を選択" },
  { from: "initiative-list", to: "cost-table", label: "同じ内容を科目別に確認" },
  { from: "initiative-list", to: "expansion-table", label: "同じ内容を展開別に確認" },
  { from: "expansion-master", to: "expansion-table", label: "グループ分け" },
];

// Relation descriptions are graph nodes, joined to both destinations.
const subNodes = edges.map((edge, index) => {
  const from = nodes.find(node => node.page === edge.from)!, to = nodes.find(node => node.page === edge.to)!;
  return { page: `relation-${index}`, name: edge.label, x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2, width: Math.max(112, edge.label.length * 12 + 24), height: 32, sub: true };
});
const graphNodes = [...nodes, ...subNodes];
const graphEdges = edges.flatMap((edge, index) => [{ from: edge.from, to: subNodes[index]!.page }, { from: subNodes[index]!.page, to: edge.to }]);

type Props = {
  onNavigate: (page: HomeDestination) => void;
  disabled: boolean;
  view: RefObject<RelationView | null>;
};
const MIN_SCALE = .05;
const MAX_SCALE = 2.5;
export function HomeRelationsPage({ onNavigate, disabled, view }: Props) {
  const [mode, setMode] = useState("relations");
  const graph = useHomeGraphMotion(graphNodes, graphEdges, view, () => { if (view.current?.fitted && !cameraTarget.current) fit(); });
  const viewport = useRef<HTMLDivElement>(null);
  const [highlighted, setActive] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const active = grabbed ?? highlighted;
  const { camera, target: cameraTarget, update, smooth, cancel: cancelZoom } = useRelationCamera(view);
  const [dragging, setDragging] = useState(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ camera: RelationView; x: number; y: number; distance: number } | null>(null);
  const moved = useRef(false);
  const fit = (animated = false) => {
    const node = viewport.current;
    if (!node || !node.clientWidth || !node.clientHeight) return;
    const positions = graphNodes.map(item => ({ ...(view.current?.positions?.[item.page] ?? { x: item.x + 100, y: item.y + 12 }), halfWidth: "width" in item ? item.width / 2 + 6 : 106 }));
    const left = Math.min(...positions.map(point => point.x - point.halfWidth)), right = Math.max(...positions.map(point => point.x + point.halfWidth));
    const top = Math.min(...positions.map(point => point.y - 18)), bottom = Math.max(...positions.map(point => point.y + 66));
    const scale = Math.max(MIN_SCALE, Math.min(1, (node.clientWidth - 80) / (right - left), (node.clientHeight - 80) / (bottom - top)));
    (animated ? smooth : update)({ x: node.clientWidth / 2 - (left + right) / 2 * scale, y: node.clientHeight / 2 - (top + bottom) / 2 * scale, scale, fitted: true });
  };
  const zoom = (factor: number, x: number, y: number) => {
    const current = cameraTarget.current ?? view.current ?? camera;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
    smooth({ x: x - (x - current.x) * scale / current.scale, y: y - (y - current.y) * scale / current.scale, scale });
  };
  const zoomCenter = (factor: number) => {
    const node = viewport.current;
    if (node) zoom(factor, node.clientWidth / 2, node.clientHeight / 2);
  };
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    if (!view.current) fit();
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1);
      zoom(Math.exp(-Math.max(-100, Math.min(100, delta)) * .006), event.clientX - rect.left, event.clientY - rect.top);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    const resize = new ResizeObserver(() => { if (view.current?.fitted && !cameraTarget.current) fit(); });
    resize.observe(node);
    return () => { node.removeEventListener("wheel", wheel); resize.disconnect(); };
  }, [view]);
  const position = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const startGesture = () => {
    const values = [...points.current.values()];
    const a = values[0];
    if (!a) { gesture.current = null; return; }
    const b = values[1] ?? a;
    gesture.current = { camera: view.current ?? camera, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: values.length > 1 ? Math.hypot(a.x - b.x, a.y - b.y) : 0 };
  };
  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (graph.pull.current?.pointerId === event.pointerId) { graph.release(); setGrabbed(null); }
    points.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    startGesture();
    if (!points.current.size) setDragging(false);
  };
  const isRelated = (edge: typeof edges[number], index: number) => edge.from === active || edge.to === active || subNodes[index]!.page === active;
  const related = new Set(edges.flatMap((edge, index) => isRelated(edge, index) ? [edge.from, edge.to] : []));
  return <main className="home-relations" aria-label="ホーム">
    <header className="home-relations-heading"><h1>Home</h1>
      <div className="home-relations-mode" role="group" aria-label="ホームの表示">
        {[["relations", "関連図"], ["data", "画面とデータ"], ["calculation", "計算の仕組み"], ["process", "処理の流れ"]].map(([id, name]) =>
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id!)}>{name}</button>)}
      </div>
    </header>
    <div hidden={mode !== "data"} style={mode === "data" ? { display: "flex", flex: 1, minHeight: 0 } : undefined}>
      <ScreenDataMap disabled={disabled} />
    </div>
    {mode === "calculation" && <MechanismMap kind="calculation" />}
    {mode === "process" && <MechanismMap kind="process" />}
    <div className="home-relations-canvas" hidden={mode !== "relations"}>
    <div ref={viewport} className={`home-relations-viewport${dragging ? " is-dragging" : ""}`} role="region" aria-label="画面とマスタの相関図" tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0) return;
        cancelZoom();
        if (!points.current.size) moved.current = false;
        const point = position(event);
        if (!points.current.size && !disabled) {
          const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".home-relation-node, .home-relation-subnode") : null;
          if (target?.dataset.page) {
            graph.begin(target.dataset.page, event.pointerId, point.x, point.y);
            setGrabbed(target.dataset.page);
          }
        } else if (points.current.size) { graph.release(); setGrabbed(null); moved.current = true; }
        points.current.set(event.pointerId, point);
        startGesture();
      }}
      onPointerMove={event => {
        if (!points.current.has(event.pointerId) || !gesture.current) return;
        points.current.set(event.pointerId, position(event));
        const values = [...points.current.values()], a = values[0];
        if (!a) return;
        const b = values[1] ?? a;
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        const start = gesture.current;
        if (!moved.current && values.length === 1 && Math.hypot(x - start.x, y - start.y) < 5) return;
        moved.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (graph.pull.current && values.length === 1) {
          graph.move(x, y, (view.current ?? camera).scale);
          return;
        }
        const scale = start.distance ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance)) : start.camera.scale;
        (values.length > 1 ? smooth : update)({ x: x - (start.x - start.camera.x) * scale / start.camera.scale, y: y - (start.y - start.camera.y) * scale / start.camera.scale, scale });
      }}
      onPointerUp={endPointer} onPointerCancel={endPointer} onLostPointerCapture={event => { if (points.current.has(event.pointerId)) endPointer(event); }}
      onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) endPointer(event); }}
      onClick={event => { if (event.target === event.currentTarget || event.target instanceof SVGElement) setActive(null); }}
      onClickCapture={event => { if (moved.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setActive(null); return; }
        if (event.target !== event.currentTarget) return;
        const current = view.current ?? camera;
        const steps: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
        const step = steps[event.key];
        if (step) { event.preventDefault(); const [x, y] = step; update({ ...current, x: current.x + x, y: current.y + y, fitted: false }); }
        else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomCenter(1.25); }
        else if (event.key === "-") { event.preventDefault(); zoomCenter(.8); }
        else if (event.key === "Home" || event.key === "0") { event.preventDefault(); fit(true); }
      }}>
      <svg className="home-relations-map" viewBox="0 0 1240 640" aria-label="画面とマスタの関係" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        {edges.map((edge, index) => <g key={`${edge.from}-${edge.to}`} className={`home-relation${active && isRelated(edge, index) ? " is-active" : active ? " is-muted" : ""}`}>
          <title>{edge.label}</title>
          {[0, 1].map(part => <path key={part} ref={element => { const key = index * 2 + part; if (element) graph.paths.current.set(key, element); else graph.paths.current.delete(key); }} />)}
          <g ref={element => { const key = subNodes[index]!.page; if (element) graph.groups.current.set(key, element); else graph.groups.current.delete(key); }}>
            <foreignObject x={subNodes[index]!.x + 100 - subNodes[index]!.width / 2} y={subNodes[index]!.y - 4} width={subNodes[index]!.width} height="32">
              <div className="home-relation-subnode" data-page={subNodes[index]!.page} role="group" tabIndex={0}
                aria-label={`${nodes.find(node => node.page === edge.from)!.name}と${nodes.find(node => node.page === edge.to)!.name}の関係：${edge.label}`}
                onMouseEnter={() => setActive(subNodes[index]!.page)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(subNodes[index]!.page)} onBlur={() => setActive(null)}>
                {edge.label}
              </div>
            </foreignObject>
          </g>
        </g>)}
        {nodes.map(node => <g key={node.page} ref={element => { if (element) graph.groups.current.set(node.page, element); else graph.groups.current.delete(node.page); }} className="home-relation-item"><foreignObject x={node.x - 6} y={node.y - 6} width="212" height={node.page === "initiative-list" ? 102 : 84}>
          <button type="button" data-page={node.page} className={`home-relation-node${node.master ? " is-master" : ""}${node.page === "initiative-list" ? " is-entry" : ""}${related.has(node.page) ? " is-related" : ""}${active === node.page ? " is-selected" : ""}`}
            disabled={disabled} onMouseEnter={() => setActive(node.page)} onMouseLeave={() => setActive(null)} onFocus={() => {
              setActive(node.page);
              if (points.current.size) return;
              const current = view.current ?? camera, box = viewport.current;
              if (!box) return;
              const position = current.positions?.[node.page] ?? { x: node.x + 100, y: node.y + 12 };
              const x = current.x + (position.x - 100) * current.scale, y = current.y + (position.y - 12) * current.scale;
              const width = 200 * current.scale, height = (node.page === "initiative-list" ? 90 : 72) * current.scale;
              if (x < 8 || y < 8 || x + width > box.clientWidth - 8 || y + height > box.clientHeight - 8)
                update({ ...current, x: box.clientWidth / 2 - position.x * current.scale, y: box.clientHeight / 2 - (position.y - 12 + height / current.scale / 2) * current.scale, fitted: false });
            }} onBlur={() => setActive(null)} onClick={() => onNavigate(node.page)}>
            <span className="home-relation-icon"><SidebarIcon name={node.icon} /></span>
            <span className="home-relation-name">{node.name}</span>
          </button>
        </foreignObject></g>)}
      </svg>
    </div>
    <div className="home-relations-controls" role="group" aria-label="相関図の表示操作">
      <button type="button" aria-label="拡大" onClick={() => zoomCenter(1.25)} disabled={camera.scale >= MAX_SCALE}>＋</button>
      <button type="button" aria-label="縮小" onClick={() => zoomCenter(.8)} disabled={camera.scale <= MIN_SCALE}>−</button>
      <button type="button" onClick={() => fit(true)}>全体表示</button>
    </div>
    </div>
  </main>;
}
