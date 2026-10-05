import { useLayoutEffect, useRef, useState, type RefObject, type PointerEvent } from "react";
import "./HomeRelations.css";

const nodes = [
  { page: "account-master", name: "勘定科目マスタ", x: 20, y: 30, master: true },
  { page: "aggregation-master", name: "集計マスタ", x: 500, y: 30, master: true },
  { page: "industry-master", name: "業種マスタ", x: 20, y: 145, master: true },
  { page: "department-master", name: "部署マスタ", x: 20, y: 235, master: true },
  { page: "period-master", name: "期間マスタ", x: 20, y: 325, master: true },
  { page: "expansion-master", name: "展開マスタ", x: 20, y: 415, master: true },
  { page: "initiative-entry", name: "施策入力", x: 500, y: 270, master: false },
  { page: "cost-table", name: "総原価表", x: 1000, y: 30, master: false },
  { page: "initiative-list", name: "施策一覧", x: 1000, y: 200, master: false },
  { page: "details", name: "明細", x: 1000, y: 305, master: false },
  { page: "expansion-table", name: "展開表", x: 1000, y: 415, master: false },
] as const;
export type HomeDestination = typeof nodes[number]["page"];
const edges: { from: HomeDestination; to: HomeDestination; label: string; path: string; x: number; y: number }[] = [
  { from: "account-master", to: "aggregation-master", label: "集計する科目", path: "M220 66H500", x: 360, y: 66 },
  { from: "aggregation-master", to: "cost-table", label: "所属・加減算", path: "M700 66H1000", x: 850, y: 66 },
  { from: "account-master", to: "initiative-entry", label: "科目を選択", path: "M220 86H250Q264 86 264 100V130Q264 144 278 144H452Q466 144 466 158V271Q466 285 480 285H500", x: 360, y: 144 },
  { from: "industry-master", to: "initiative-entry", label: "業種名を選択", path: "M220 181H414Q428 181 428 195V286Q428 300 442 300H500", x: 324, y: 181 },
  { from: "department-master", to: "initiative-entry", label: "部署名を選択", path: "M220 271H380Q394 271 394 285V301Q394 315 408 315H500", x: 308, y: 271 },
  { from: "period-master", to: "initiative-entry", label: "期間名を選択", path: "M220 361H420Q434 361 434 347V344Q434 330 448 330H500", x: 324, y: 361 },
  { from: "expansion-master", to: "initiative-entry", label: "展開名を選択", path: "M220 451H454Q468 451 468 437V359Q468 345 482 345H500", x: 324, y: 451 },
  { from: "initiative-entry", to: "cost-table", label: "同じ内容を科目別に確認", path: "M700 285H716Q730 285 730 271V114Q730 100 744 100H974Q988 100 988 86H1000", x: 850, y: 100 },
  { from: "initiative-entry", to: "initiative-list", label: "登録した施策を確認", path: "M700 300H740Q754 300 754 286V250Q754 236 768 236H1000", x: 864, y: 236 },
  { from: "initiative-entry", to: "details", label: "同じ内容を月別・科目別に確認", path: "M700 330H740Q754 330 754 341H1000", x: 852, y: 341 },
  { from: "initiative-entry", to: "expansion-table", label: "同じ内容を展開別に確認", path: "M700 345H710Q724 345 724 359V437Q724 451 738 451H1000", x: 850, y: 451 },
  { from: "expansion-master", to: "expansion-table", label: "グループ分け", path: "M220 471H250Q264 471 264 485V496Q264 510 278 510H958Q972 510 972 496V485Q972 471 986 471H1000", x: 610, y: 510 },
];

export type RelationView = { x: number; y: number; scale: number; fitted?: boolean };
type Props = {
  onNavigate: (page: HomeDestination) => void;
  disabled: boolean;
  view: RefObject<RelationView | null>;
};
const MIN_SCALE = .05;
const MAX_SCALE = 2.5;
export function HomeRelationsPage({ onNavigate, disabled, view }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<HomeDestination | null>(null);
  const [camera, setCamera] = useState<RelationView>(view.current ?? { x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ camera: RelationView; x: number; y: number; distance: number } | null>(null);
  const moved = useRef(false);
  const update = (next: RelationView) => { view.current = next; setCamera(next); };
  const fit = () => {
    const node = viewport.current;
    if (!node) return;
    const scale = Math.max(MIN_SCALE, Math.min(1, (node.clientWidth - 32) / 1240, (node.clientHeight - 32) / 550));
    update({ x: (node.clientWidth - 1240 * scale) / 2, y: (node.clientHeight - 550 * scale) / 2, scale, fitted: true });
  };
  const zoom = (factor: number, x: number, y: number) => {
    const current = view.current ?? camera;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
    update({ x: x - (x - current.x) * scale / current.scale, y: y - (y - current.y) * scale / current.scale, scale });
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
        if (!points.current.size) moved.current = false;
        points.current.set(event.pointerId, position(event));
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
        setActive(null);
        event.currentTarget.setPointerCapture(event.pointerId);
        const scale = start.distance ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance)) : start.camera.scale;
        update({ x: x - (start.x - start.camera.x) * scale / start.camera.scale, y: y - (start.y - start.camera.y) * scale / start.camera.scale, scale });
      }}
      onPointerUp={endPointer} onPointerCancel={endPointer}
      onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) endPointer(event); }}
      onClickCapture={event => { if (moved.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const current = view.current ?? camera;
        const steps: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
        const step = steps[event.key];
        if (step) { event.preventDefault(); const [x, y] = step; update({ ...current, x: current.x + x, y: current.y + y, fitted: false }); }
        else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomCenter(1.25); }
        else if (event.key === "-") { event.preventDefault(); zoomCenter(.8); }
        else if (event.key === "Home" || event.key === "0") { event.preventDefault(); fit(); }
      }}>
      <svg className="home-relations-map" viewBox="0 0 1240 550" aria-label="画面とマスタの関係" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }} onMouseLeave={() => setActive(null)}>
        {edges.map(edge => <g key={`${edge.from}-${edge.to}`} className={`home-relation${active && (edge.from === active || edge.to === active) ? " is-active" : active ? " is-muted" : ""}`}>
          <path d={edge.path} />
          <rect x={edge.x - (edge.label.length * 7 + 16)} y={edge.y - 16} width={edge.label.length * 14 + 32} height={32} rx={16} />
          <text x={edge.x} y={edge.y} dominantBaseline="central" textAnchor="middle">{edge.label}</text>
        </g>)}
        {nodes.map(node => <foreignObject key={node.page} x={node.x - 6} y={node.y - 6} width="212" height={node.page === "initiative-entry" ? 102 : 84}>
          <button type="button" className={`home-relation-node${node.master ? " is-master" : ""}${node.page === "initiative-entry" ? " is-entry" : ""}${related.has(node.page) ? " is-related" : ""}`}
            disabled={disabled} onMouseEnter={() => setActive(node.page)} onFocus={() => {
              setActive(node.page);
              if (points.current.size) return;
              const current = view.current ?? camera, box = viewport.current;
              if (!box) return;
              const x = current.x + node.x * current.scale, y = current.y + node.y * current.scale;
              const width = 200 * current.scale, height = (node.page === "initiative-entry" ? 90 : 72) * current.scale;
              if (x < 8 || y < 8 || x + width > box.clientWidth - 8 || y + height > box.clientHeight - 8)
                update({ ...current, x: box.clientWidth / 2 - (node.x + 100) * current.scale, y: box.clientHeight / 2 - (node.y + height / current.scale / 2) * current.scale, fitted: false });
            }} onBlur={() => setActive(null)} onClick={() => onNavigate(node.page)}>
            {node.name}
          </button>
        </foreignObject>)}
      </svg>
    </div>
    <div className="home-relations-controls" role="group" aria-label="相関図の表示操作">
      <button type="button" aria-label="拡大" onClick={() => zoomCenter(1.25)} disabled={camera.scale >= MAX_SCALE}>＋</button>
      <button type="button" aria-label="縮小" onClick={() => zoomCenter(.8)} disabled={camera.scale <= MIN_SCALE}>−</button>
      <button type="button" onClick={fit}>全体表示</button>
    </div>
    </div>
    <p className="home-relations-hint">ドラッグで移動 · ホイール・ピンチで拡大縮小</p>
  </main>;
}
