import { useLayoutEffect, useRef, useState, type RefObject, type PointerEvent } from "react";
import "./HomeRelations.css";
import { useHomeGraphMotion } from "./useHomeGraphMotion";
import { useRelationCamera, type RelationView } from "./useRelationCamera";
export type { RelationView } from "./useRelationCamera";

const nodes = [
  { page: "account-master", name: "勘定科目マスタ", x: 260, y: 150, master: true },
  { page: "aggregation-master", name: "集計マスタ", x: 520, y: 70, master: true },
  { page: "industry-master", name: "業種マスタ", x: 180, y: 290, master: true },
  { page: "department-master", name: "部署マスタ", x: 260, y: 430, master: true },
  { page: "period-master", name: "期間マスタ", x: 390, y: 530, master: true },
  { page: "expansion-master", name: "展開マスタ", x: 550, y: 560, master: true },
  { page: "kind-master", name: "種別マスタ", x: 370, y: 60, master: true },
  { page: "previous-input", name: "前年入力", x: 750, y: 60, master: false },
  { page: "initiative-entry", name: "施策入力", x: 520, y: 308, master: false },
  { page: "cost-table", name: "総原価表", x: 850, y: 220, master: false },
  { page: "initiative-list", name: "施策一覧", x: 880, y: 360, master: false },
  { page: "details", name: "明細", x: 760, y: 480, master: false },
  { page: "expansion-table", name: "展開表", x: 950, y: 520, master: false },
] as const;

export type HomeDestination = typeof nodes[number]["page"];
const edges: { from: HomeDestination; to: HomeDestination; label: string }[] = [
  { from: "previous-input", to: "cost-table", label: "前年の実額" },
  { from: "kind-master", to: "initiative-entry", label: "種別ごとに入力" },
  { from: "previous-input", to: "details", label: "前年の明細" },
  { from: "account-master", to: "aggregation-master", label: "集計する科目" },
  { from: "aggregation-master", to: "cost-table", label: "所属・加減算" },
  { from: "account-master", to: "initiative-entry", label: "科目を選択" },
  { from: "industry-master", to: "initiative-entry", label: "業種名を選択" },
  { from: "department-master", to: "initiative-entry", label: "部署名を選択" },
  { from: "period-master", to: "initiative-entry", label: "期間名を選択" },
  { from: "expansion-master", to: "initiative-entry", label: "展開名を選択" },
  { from: "initiative-entry", to: "cost-table", label: "同じ内容を科目別に確認" },
  { from: "initiative-entry", to: "initiative-list", label: "登録した施策を確認" },
  { from: "initiative-entry", to: "details", label: "同じ内容を月別・科目別に確認" },
  { from: "initiative-entry", to: "expansion-table", label: "同じ内容を展開別に確認" },
  { from: "expansion-master", to: "expansion-table", label: "グループ分け" },
];

type Props = {
  onNavigate: (page: HomeDestination) => void;
  disabled: boolean;
  view: RefObject<RelationView | null>;
};
const MIN_SCALE = .05;
const MAX_SCALE = 2.5;
export function HomeRelationsPage({ onNavigate, disabled, view }: Props) {
  const graph = useHomeGraphMotion(nodes, edges, view);
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<HomeDestination | null>(null);
  const { camera, target: cameraTarget, update, smooth, cancel: cancelZoom } = useRelationCamera(view);
  const [dragging, setDragging] = useState(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ camera: RelationView; x: number; y: number; distance: number } | null>(null);
  const moved = useRef(false);
  const fit = (animated = false) => {
    const node = viewport.current;
    if (!node) return;
    const positions = nodes.map(item => view.current?.positions?.[item.page] ?? { x: item.x + 100, y: item.y + 12 });
    const left = Math.min(...positions.map(point => point.x - 106)), right = Math.max(...positions.map(point => point.x + 106));
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
    const resize = new ResizeObserver(() => { if (view.current?.fitted) fit(); });
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
    if (graph.pull.current?.pointerId === event.pointerId) graph.release();
    points.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    startGesture();
    if (!points.current.size) setDragging(false);
  };
  const related = new Set(edges.filter(edge => edge.from === active || edge.to === active).flatMap(edge => [edge.from, edge.to]));
  return <main className="home-relations" aria-label="ホーム">
    <h1>Home</h1>
    <div className="home-relations-canvas">
    <div ref={viewport} className={`home-relations-viewport${dragging ? " is-dragging" : ""}`} role="region" aria-label="画面とマスタの相関図" tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0) return;
        cancelZoom();
        if (!points.current.size) moved.current = false;
        const point = position(event);
        if (!points.current.size && !disabled) {
          const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".home-relation-node") : null;
          if (target?.dataset.page) graph.begin(target.dataset.page, event.pointerId, point.x, point.y);
        } else if (points.current.size) { graph.release(); moved.current = true; }
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
        {edges.map((edge, index) => <g key={`${edge.from}-${edge.to}`} className={`home-relation${active && (edge.from === active || edge.to === active) ? " is-active" : active ? " is-muted" : ""}`}>
          <path ref={element => { if (element) graph.paths.current.set(index, element); else graph.paths.current.delete(index); }}><title>{edge.label}</title></path>
        </g>)}
        {nodes.map(node => <g key={node.page} ref={element => { if (element) graph.groups.current.set(node.page, element); else graph.groups.current.delete(node.page); }} className="home-relation-item"><foreignObject x={node.x - 6} y={node.y - 6} width="212" height={node.page === "initiative-entry" ? 102 : 84}>
          <button type="button" data-page={node.page} className={`home-relation-node${node.master ? " is-master" : ""}${node.page === "initiative-entry" ? " is-entry" : ""}${related.has(node.page) ? " is-related" : ""}${active === node.page ? " is-selected" : ""}`}
            disabled={disabled} onMouseEnter={() => setActive(node.page)} onMouseLeave={() => setActive(null)} onFocus={() => {
              setActive(node.page);
              if (points.current.size) return;
              const current = view.current ?? camera, box = viewport.current;
              if (!box) return;
              const position = current.positions?.[node.page] ?? { x: node.x + 100, y: node.y + 12 };
              const x = current.x + (position.x - 100) * current.scale, y = current.y + (position.y - 12) * current.scale;
              const width = 200 * current.scale, height = (node.page === "initiative-entry" ? 90 : 72) * current.scale;
              if (x < 8 || y < 8 || x + width > box.clientWidth - 8 || y + height > box.clientHeight - 8)
                update({ ...current, x: box.clientWidth / 2 - position.x * current.scale, y: box.clientHeight / 2 - (position.y - 12 + height / current.scale / 2) * current.scale, fitted: false });
            }} onBlur={() => setActive(null)} onClick={() => onNavigate(node.page)}>
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
    <p className="home-relations-hint">クリックで開く · 項目をドラッグで移動 · 背景をドラッグで移動 · ホイール・ピンチで拡大縮小</p>
  </main>;
}
