import { createPortal } from "react-dom";
import { FadeSwap } from "./FadeSwap";
import { useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import { buildAccountTree, buildDashboard, buildDashboardFlows, buildImpactTree, monthContributions, sumDashboardAmounts, type Contribution, type DashboardDirection, type DashboardMetric, type DashboardNode } from "../core/dashboard";
import { currentFiscalYear, initiativeMonths, type Initiative, type InitiativeMonth, type PlanContents } from "../core/initiatives";
import { formatAmount } from "../core/amounts";
import { PieChart, SankeyChart, SunburstChart, TreemapChart } from "./DashboardCharts";
import "./Dashboard.css";

type Selection = { kind: "sun" | "tree" | "pie" | "flow" | "month" | "bar" | "summary"; key: string; metric: DashboardMetric };
export type DashboardView = { year: string; metric: DashboardMetric; direction: DashboardDirection; sunPath: string[]; selection: Selection | null };
export const createDashboardView = (contents: PlanContents): DashboardView => ({ year: String(contents.initiatives[0]?.fiscalYear ?? currentFiscalYear()), metric: "profit", direction: "increase", sunPath: [], selection: null });
function findNode(root: DashboardNode, key: string): DashboardNode | undefined {
  if (root.key === key) return root;
  for (const child of root.children) { const found = findNode(child, key); if (found) return found; }
  return undefined;
}
const amountText = (value: number | null) => value === null ? "未入力" : `${value > 0 ? "+" : ""}${formatAmount(value)}`;
const metricName = (metric: DashboardMetric) => metric === "sales" ? "売上" : "利益";
function Card({ title, subtitle, empty, children, actions }: { title: string; subtitle: string; empty: boolean; children: ReactNode; actions?: ReactNode }) {
  return <section className="dashboard-card" aria-label={title}><header><div><h2>{title}</h2><p>{subtitle}</p></div>{actions}</header>
    {empty ? <div className="dashboard-empty">表示できる金額がありません。<span>金額が0の施策は年間増減の内訳から確認できます。</span></div> : children}
  </section>;
}

function DashboardContent({ contents, view, onChange, onOpenInitiative, data, onRestoreScroll }: { onRestoreScroll: () => void; data: ReturnType<typeof calculateDashboard>; contents: PlanContents; view: DashboardView; onChange: (view: DashboardView) => void; onOpenInitiative: (initiative: Initiative) => void }) {
  const { year, metric, direction, selection } = view;
  useLayoutEffect(onRestoreScroll, [onRestoreScroll]);
  const years = [...new Set([Number(year), currentFiscalYear(), ...contents.initiatives.flatMap(item => item.fiscalYear === null ? [] : [item.fiscalYear])])].sort((a, b) => b - a);
  const sunRoot = view.sunPath.reduce((node, key) => node.children.find(child => child.key === key) ?? node, data.sun);
  const select = (kind: Selection["kind"], key: string, selectedMetric = metric) => onChange({ ...view, selection: { kind, key, metric: selectedMetric } });
  const pickSun = (node: DashboardNode) => onChange({ ...view, sunPath: node.children.length ? [...view.sunPath, node.key] : view.sunPath, selection: { kind: "sun", key: node.key, metric } });
  let detail: { title: string; contributions: Contribution[]; all?: boolean } | null = null;
  if (selection) {
    if (["sun", "tree", "pie"].includes(selection.kind)) {
      const root = selection.kind === "sun" ? data.sun : selection.kind === "tree" ? data.tree : data.pie;
      const node = findNode(root, selection.key);
      if (node) detail = { title: node.name, contributions: node.contributions };
    } else if (selection.kind === "flow") {
      const flows = data.flows.filter(flow => [`expansion:${flow.expansionId}`, `initiative:${flow.initiativeId}`, `account:${flow.accountId}`].includes(selection.key));
      const first = flows[0];
      if (first) detail = { title: selection.key.startsWith("initiative:") ? first.initiative : selection.key.startsWith("account:") ? first.account : first.expansion, contributions: flows };
    } else if (selection.kind === "month") {
      detail = { title: `${selection.key}月の${metricName(selection.metric)}増減`, contributions: monthContributions(data.impacts, Number(selection.key) as InitiativeMonth, selection.metric) };
    } else {
      const impacts = selection.kind === "bar" ? data.impacts.filter(item => `initiative:${item.initiative.id}` === selection.key) : data.impacts;
      detail = { title: selection.kind === "bar" ? impacts[0]?.initiative.name ?? "施策" : `年間の${metricName(selection.metric)}増減`,
        contributions: impacts.flatMap(item => item[selection.metric] === null ? [] : [{ initiativeId: item.initiative.id, amount: item[selection.metric]! }]), all: selection.kind === "summary" };
    }
  }
  const detailAmounts = new Map<number, number>();
  for (const contribution of detail?.contributions ?? []) detailAmounts.set(contribution.initiativeId, sumDashboardAmounts([detailAmounts.get(contribution.initiativeId), contribution.amount])!);
  const detailInitiatives = data.impacts.filter(item => detail?.all || detailAmounts.has(item.initiative.id));
  const detailPanel = useMemo(() => detail ? {
    title: detail.title,
    context: selection?.kind === "sun" ? `集計への寄与 · ${direction === "increase" ? "増加分" : "減少分"}（相殺前）`
      : selection?.kind === "flow" ? `科目金額 · ${direction === "increase" ? "増加分" : "減少分"}（相殺前）`
      : `${metricName(selection?.metric ?? metric)}への影響`,
    rows: detailInitiatives.map(({ initiative }) => ({ initiative, amount: detailAmounts.get(initiative.id) ?? null })),
  } : null, [data, selection, direction, metric]);
  const values = data.months.flatMap(item => [item.sales, item.profit]).filter((value): value is number => value !== null);
  const minY = Math.min(0, ...values), maxY = Math.max(0, ...values);
  const y = (value: number) => maxY === minY ? 155 : 260 - (value - minY) / (maxY - minY) * 210;
  const x = (index: number) => 58 + index * 37;
  const bars = [...data.impacts].filter(item => item.profit !== null && item.profit !== 0).sort((a, b) => Math.abs(b.profit!) - Math.abs(a.profit!));
  const barMaximum = Math.max(1, ...bars.map(item => Math.abs(item.profit!)));
  return <main className="home-view dashboard" aria-label="ホーム">
    <div className="dashboard-toolbar"><h1>Home</h1><label>年度<select value={year} onChange={event => onChange({ ...view, year: event.target.value, sunPath: [], selection: null })}>{years.map(item => <option key={item} value={item}>{item}年度</option>)}</select></label><span>施策による増減額 · 千円</span></div>
    <div className="dashboard-summary">{(["sales", "profit"] as const).map(item => <button type="button" key={item} onClick={() => select("summary", item, item)} aria-pressed={selection?.kind === "summary" && selection.metric === item}>
      <span>年間の{metricName(item)}増減</span><strong>{data.impacts.length === 0 ? "施策なし" : amountText(data[item])}</strong><span className="dashboard-summary-hint">内訳を見る ↗</span>
    </button>)}</div>
    <div className="dashboard-controls"><div role="group" aria-label="面積・流れの表示対象">{(["increase", "decrease"] as const).map(item => <button type="button" key={item} aria-pressed={direction === item} onClick={() => onChange({ ...view, direction: item, sunPath: [], selection: null })}>{item === "increase" ? "増加分" : "減少分"}</button>)}</div>
      <label>施策・部署の影響額<select value={metric} onChange={event => onChange({ ...view, metric: event.target.value as DashboardMetric, selection: null })}><option value="profit">利益</option><option value="sales">売上</option></select></label>
    </div>
    <div className="dashboard-grid">
      <Card title="月別の増減" subtitle="売上・利益の推移" empty={values.length === 0}>
        <svg className="dashboard-svg" viewBox="0 0 500 330" aria-label="月別の売上・利益の折れ線グラフ">
          {[minY, 0, maxY].filter((value, index, array) => array.indexOf(value) === index).map(value => <g key={value}><line x1="58" x2="465" y1={y(value)} y2={y(value)} stroke="#ddd" /><text x="52" y={y(value) + 4} textAnchor="end">{formatAmount(value)}</text></g>)}
          {(["sales", "profit"] as const).map(item => {
            let path = ""; let previous = false;
            data.months.forEach((month, index) => { if (month[item] === null) { previous = false; return; } path += `${previous ? "L" : "M"}${x(index)},${y(month[item]!)} `; previous = true; });
            return <g key={item}><path d={path} fill="none" stroke={item === "sales" ? "#999" : "#222"} strokeWidth="2" strokeDasharray={item === "sales" ? "5 4" : undefined} />
              {data.months.map((month, index) => month[item] === null ? null : <g key={month.month} className="dashboard-mark" role="button" tabIndex={0} aria-label={`${month.month}月の${metricName(item)} ${amountText(month[item])}千円`} aria-pressed={selection?.kind === "month" && selection.key === String(month.month) && selection.metric === item}
                onClick={() => select("month", String(month.month), item)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select("month", String(month.month), item); } }}>
                <title>{month.month}月の{metricName(item)} {amountText(month[item])}千円</title><circle cx={x(index)} cy={y(month[item])} r="12" fill="transparent" /><circle cx={x(index)} cy={y(month[item])} r="4" fill={item === "sales" ? "#999" : "#222"} />
              </g>)}</g>;
          })}
          {initiativeMonths.map((month, index) => <text key={month} x={x(index)} y="288" textAnchor="middle">{month}月</text>)}
          <text x="190" y="316" fill="#777">┄ 売上</text><text x="285" y="316">━ 利益</text>
        </svg>
      </Card>
      <Card title="施策の利益への影響" subtitle="年間・増加／減少それぞれ大きい順" empty={bars.length === 0}>
        <div className="dashboard-bars"><div className="dashboard-bar-axis"><span>減少</span><span>0</span><span>増加</span></div>{[1, -1].map(sign => <div key={sign} className="dashboard-bar-group">{bars.filter(item => Math.sign(item.profit!) === sign).map(item => <button type="button" key={item.initiative.id} aria-pressed={selection?.kind === "bar" && selection.key === `initiative:${item.initiative.id}`} onClick={() => select("bar", `initiative:${item.initiative.id}`, "profit")}>
          <span>{item.initiative.name}</span><span className="dashboard-bar-track"><i style={{ width: `${Math.abs(item.profit!) / barMaximum * 50}%`, left: item.profit! < 0 ? `${50 - Math.abs(item.profit!) / barMaximum * 50}%` : "50%" }} /></span><strong>{amountText(item.profit)}</strong>
        </button>)}</div>)}</div>
      </Card>
      <Card title="集計・科目の内訳" subtitle={`サンバースト · ${direction === "increase" ? "増加分" : "減少分"}／集計の加減算を反映／相殺前`} empty={sunRoot.value === 0}
        actions={view.sunPath.length > 0 ? <button type="button" className="text-button" onClick={() => onChange({ ...view, sunPath: view.sunPath.slice(0, -1), selection: null })}>戻る</button> : undefined}>
        <FadeSwap value={sunRoot}>{root => <SunburstChart root={root} selected={selection?.kind === "sun" ? selection.key : undefined} onPick={pickSun} />}</FadeSwap>
        {view.sunPath.length > 0 && <p className="dashboard-breadcrumb">全体 / {view.sunPath.map(key => findNode(data.sun, key)?.name).join(" / ")}</p>}
      </Card>
      <Card title="展開区分・施策の内訳" subtitle={`ツリーマップ · 年間の${metricName(metric)}への影響／${direction === "increase" ? "増加分" : "減少分"}`} empty={data.tree.value === 0}>
        <FadeSwap value={data.tree}>{root => <TreemapChart root={root} selected={selection?.kind === "tree" ? selection.key : undefined} onPick={node => select("tree", node.key)} />}</FadeSwap>
      </Card>
      <Card title="金額のつながり" subtitle={`サンキー · 科目金額／${direction === "increase" ? "増加分" : "減少分"}（相殺前）`} empty={data.flows.length === 0}>
        <FadeSwap value={data.flows}>{flows => <SankeyChart flows={flows} selected={selection?.kind === "flow" ? selection.key : undefined} onPick={key => select("flow", key)} />}</FadeSwap>
      </Card>
      <Card title="部署別の構成" subtitle={`円グラフ · 年間の${metricName(metric)}への影響／${direction === "increase" ? "増加分" : "減少分"}`} empty={data.pie.value === 0}>
        <FadeSwap value={data.pie}>{root => <PieChart root={root} selected={selection?.kind === "pie" ? selection.key : undefined} onPick={node => select("pie", node.key)} />}</FadeSwap>
      </Card>
    </div>
    {createPortal(<div className="dashboard-detail-layer"><FadeSwap value={detailPanel} className="motion-text">{panel => panel && <aside className="dashboard-detail" role="region" aria-label="選択した内訳"><header><div><span>選択した内訳 · 千円</span><h2>{panel.title}</h2><p>{panel.context}</p></div><button type="button" aria-label="選択を解除" onClick={() => onChange({ ...view, selection: null })}>×</button></header>
      <div className="dashboard-detail-list">{panel.rows.length ? panel.rows.map(({ initiative, amount }) => <button type="button" key={initiative.id} onClick={() => onOpenInitiative(initiative)}><span>{initiative.name}</span><strong>{amountText(amount)}</strong><span className="dashboard-summary-hint">編集 ↗</span></button>) : <p>この条件に該当する入力はありません。</p>}</div>
    </aside>}</FadeSwap></div>, document.body)}
    {data.impacts.length === 0 && <p className="dashboard-no-initiatives">この年度の施策はまだ登録されていません。</p>}
  </main>;
}

function calculateDashboard(contents: PlanContents, view: DashboardView) {
  const summary = buildDashboard(contents, Number(view.year));
  return { ...summary, sun: buildAccountTree(contents, Number(view.year), view.direction),
    tree: buildImpactTree(contents, summary.impacts, view.metric, view.direction, "expansion"),
    pie: buildImpactTree(contents, summary.impacts, view.metric, view.direction, "department"),
    flows: buildDashboardFlows(contents, Number(view.year), view.direction) };
}
export function DashboardPage(props: Omit<Parameters<typeof DashboardContent>[0], "data">) {
  useEffect(() => {
    if (!props.view.selection) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault(); event.stopPropagation();
        props.onChange({ ...props.view, selection: null });
      }
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [props.view, props.onChange]);
  const result = useMemo(() => {
    try { return { data: calculateDashboard(props.contents, props.view), error: null }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : "金額を計算できませんでした。" }; }
  }, [props.contents, props.view.year, props.view.metric, props.view.direction]);
  if (!result.data) return <main className="home-view dashboard" aria-label="ホーム"><p role="alert">{result.error}</p></main>;
  return <DashboardContent {...props} data={result.data} />;
}
