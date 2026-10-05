import { useLayoutEffect, useRef, useState, type RefObject } from "react";
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

type Props = {
  onNavigate: (page: HomeDestination) => void;
  disabled: boolean;
  scroll: RefObject<{ top: number; left: number }>;
};
export function HomeRelationsPage({ onNavigate, disabled, scroll }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<HomeDestination | null>(null);
  useLayoutEffect(() => {
    if (viewport.current) { viewport.current.scrollTop = scroll.current.top; viewport.current.scrollLeft = scroll.current.left; }
  }, [scroll]);
  const related = new Set(edges.filter(edge => edge.from === active || edge.to === active).flatMap(edge => [edge.from, edge.to]));
  return <main className="home-relations" aria-label="ホーム">
    <h1>Home</h1>
    <div ref={viewport} className="home-relations-viewport" role="region" aria-label="画面とマスタの相関図" tabIndex={0}
      onScroll={event => { scroll.current = { top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft }; }}>
      <svg className="home-relations-map" viewBox="0 0 1240 550" aria-label="画面とマスタの関係" onMouseLeave={() => setActive(null)}>
        {edges.map(edge => <g key={`${edge.from}-${edge.to}`} className={`home-relation${active && (edge.from === active || edge.to === active) ? " is-active" : active ? " is-muted" : ""}`}>
          <path d={edge.path} />
          <rect x={edge.x - (edge.label.length * 7 + 16)} y={edge.y - 16} width={edge.label.length * 14 + 32} height={32} rx={16} />
          <text x={edge.x} y={edge.y} dominantBaseline="central" textAnchor="middle">{edge.label}</text>
        </g>)}
        {nodes.map(node => <foreignObject key={node.page} x={node.x - 6} y={node.y - 6} width="212" height={node.page === "initiative-entry" ? 102 : 84}>
          <button type="button" className={`home-relation-node${node.master ? " is-master" : ""}${node.page === "initiative-entry" ? " is-entry" : ""}${related.has(node.page) ? " is-related" : ""}`}
            disabled={disabled} onMouseEnter={() => setActive(node.page)} onFocus={() => setActive(node.page)} onBlur={() => setActive(null)} onClick={() => onNavigate(node.page)}>
            {node.name}
          </button>
        </foreignObject>)}
      </svg>
    </div>
  </main>;
}
