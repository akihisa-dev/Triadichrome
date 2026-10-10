import { initiativeMonths } from "../../Triadichrome-extension/src/core/domain/calendar";
import { yenToAmount } from "../../Triadichrome-extension/src/core/domain/amounts";
import type { InitiativeRow } from "../../Triadichrome-extension/src/core/domain/plan";

/** A finite business portfolio, not a volume multiplier. Amounts describe changes from last year. */
export const PORTFOLIO_COUNT = 7 * 9 * 2;
const operations = ["車両整備", "法人車両", "月極賃貸", "施設運営", "定期配送", "構内作業", "委託管理", "本社支援", "保有資産"];
const programs = ["契約単価の見直し", "サービス料金改定", "低採算業務の終了", "繁忙期の受注増", "新規顧客の開拓", "作業手順の改善", "担当業務の移管"];

export function portfolioScenario(expansionIndex: number, industryIndex: number, departmentIndex: number, accounts: Map<string, number>) {
  const base = 40 + industryIndex * 8 + (expansionIndex === 6 ? 0 : departmentIndex * 5);
  const start = expansionIndex === 2 || expansionIndex === 4 ? 3 : expansionIndex === 1 ? 6 : 0;
  const monthly = (calculate: (index: number) => number) => Object.fromEntries(initiativeMonths.map((month, index) => [month, yenToAmount(calculate(index))]));
  // Seasonal capacity rises in July, December and March; transfers have equal outgoing/incoming amounts.
  const activity = (index: number) => index < start ? 0 : base * 1000 + (index + 1) * 1000 + ([3, 8, 11].includes(index) ? base * 500 : 0);
  const transfer = departmentIndex === 0 ? -1 : 1;
  const income = (index: number) => {
    const value = activity(index);
    if (expansionIndex === 0 || expansionIndex === 5) return 0;
    if (expansionIndex === 2) return -value;
    if (expansionIndex === 6) return transfer * ((40 + industryIndex * 8) * 1000 + (index + 1) * 1000);
    return value;
  };
  const cost = (index: number) => expansionIndex === 0 ? -Math.round(activity(index) * 0.12) : expansionIndex === 5 ? -Math.round(activity(index) * 0.08) : Math.round(income(index) * 0.35);
  const payroll = (index: number) => index < start ? 0 : expansionIndex === 5 ? -3000 - industryIndex * 100 : expansionIndex === 2 ? -5000 : expansionIndex === 6 ? transfer * 5000 : 5000 + departmentIndex * 1000;
  const freight = (index: number) => index < start ? 0 : expansionIndex === 0 || expansionIndex === 5 ? -1251 : expansionIndex === 2 ? -1000 : expansionIndex === 6 ? transfer * 1000 : 1000 + index * 50;
  const promotion = (index: number) => index < start ? 0 : expansionIndex === 4 ? (index === start ? 18000 : 2000) : expansionIndex === 2 ? -2000 : expansionIndex === 6 ? 0 : 1500;
  const incentive = (index: number) => expansionIndex === 5 && index === 8 ? 12000 : expansionIndex === 4 && index === 11 ? 5001 : 0;
  const definitions: [string, (index: number) => number][] = [["売上高", income], ["本支店売上原価", cost], ["給料手当", payroll], ["通信運搬費", freight], ["宣伝広告費", promotion], ["営業外収益", incentive]];
  const rows: InitiativeRow[] = definitions.map(([name, calculate], index) => ({
    accountId: accounts.get(name)!, amounts: monthly(calculate),
    // April's explicit equal override, October's revision and March's explicit zero are distinct.
    overrides: { 2: index === 0 ? { 4: yenToAmount(calculate(0)), 10: yenToAmount(calculate(6) + (expansionIndex === 6 ? transfer * 2000 : 2000)), 3: "0" } : index === 2 ? { 10: yenToAmount(calculate(6) + (expansionIndex === 6 ? transfer * 1000 : 1000)) } : {} },
  }));
  return {
    name: `${operations[industryIndex]}・${programs[expansionIndex]}・${departmentIndex === 0 ? "東" : "西"}`,
    note: `${departmentIndex === 0 ? "東側拠点（部署A）" : "西側拠点（部署B）"}の${operations[industryIndex]}。${programs[expansionIndex]}を${initiativeMonths[start]}月から実施。月次の基準増減は${base}千円、${expansionIndex === 6 ? "毎月1千円ずつ受渡額を増やす。" : "7月・12月・3月は繁忙補正。"}${expansionIndex === 2 ? "売上の減少と原価・人件費・広告費の削減を同時に計上。" : expansionIndex === 6 ? "部署Aを移管元、部署Bを移管先とし、同額の収益・費用を振り替える。" : expansionIndex === 0 || expansionIndex === 5 ? "売上を水増しせず、契約・作業に伴う費用削減を計上。" : "売上増に対応する原価35%、人員・配送・販促の追加負担を計上。"}確定では10月の条件を見直し、3月売上は未契約分を明示0。${expansionIndex === 0 || expansionIndex === 5 ? "通信運搬費の削減には1円端数を保持。" : "配送費は稼働月に応じて段階的に計上。"}${expansionIndex === 5 ? "12月に改善助成12千円。" : expansionIndex === 4 ? "3月に開拓助成5,001円。" : "助成金は計上しない。"}`,
    rows,
  };
}
