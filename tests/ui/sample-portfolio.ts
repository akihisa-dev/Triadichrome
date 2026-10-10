import { initiativeMonths } from "../../Triadichrome-extension/src/core/domain/calendar";
import { yenToAmount } from "../../Triadichrome-extension/src/core/domain/amounts";
import type { InitiativeRow } from "../../Triadichrome-extension/src/core/domain/plan";

export const PORTFOLIO_COUNT = 7 * 9 * 2;
const operations = ["車両整備", "法人車両", "月極賃貸", "施設運営", "定期配送", "構内作業", "委託管理", "本社支援", "保有資産"];
const assets = ["診断装置", "洗車設備", "入退場設備", "空調設備", "積替設備", "搬送装置", "管理端末", "業務端末", "監視装置"];
const costCategories = ["下払いUP", "ベースアップ", "設備投資", "燃料費UP", "電気料金UP"];
type Monthly = (index: number) => number;

/** Amounts are changes from last year, in yen. Each override describes a business revision. */
export function portfolioScenario(e: number, i: number, d: number, accounts: Map<string, number>) {
  const operation = operations[i]!;
  const region = d === 0 ? "東" : "西";
  const rows: InitiativeRow[] = [];
  const add = (name: string, primary: Monthly, confirmed: Monthly = primary, explicitEqual: number[] = []) => {
    const accountId = accounts.get(name);
    if (accountId === undefined) throw new Error(`サンプルに必要な科目がありません: ${name}`);
    const overrides = Object.fromEntries(initiativeMonths.flatMap((month, index) => {
      const value = confirmed(index);
      return value !== primary(index) || explicitEqual.includes(month) ? [[month, yenToAmount(value)]] : [];
    }));
    rows.push({ accountId, amounts: Object.fromEntries(initiativeMonths.map((month, index) => [month, yenToAmount(primary(index))])), overrides: { 2: overrides } });
  };
  let program: string;
  let rationale: string;
  let categoryName: string | null = null;
  const volume = 20 + i * 3 + d * 2;
  const base = (40 + i * 8 + d * 5) * 1000;
  if (e === 0) {
    const category = (i * 2 + d) % 5;
    categoryName = costCategories[category]!;
    if (category === 0) {
      program = "委託作業単価の上昇";
      const jobs = (j: number) => 10 + i * 2 + d + ([3, 8].includes(j) ? 5 : 0);
      add("下払作業賃", j => jobs(j) * 800, j => jobs(j) * (j >= 3 ? 900 : 800), [4]);
      add("外注費", j => j === 6 ? 1500 + d * 500 : 0);
      rationale = `毎月${10 + i * 2 + d}件、7月・12月は5件増の委託作業。前年契約に対する追加単価800円/件を下払作業賃へ正額計上。10月の契約監査は外注費${1500 + d * 500}円。確定は7月の委託先合意により追加単価900円/件へ改定、4月は同額で確定。売上増は計上しない。`;
    } else if (category === 1) {
      program = "給与ベースアップ";
      const people = 4 + i + d;
      const salary = (j: number, confirmed: boolean) => people * (confirmed && j >= 3 ? 3500 : 3000);
      add("給料手当", j => salary(j, false), j => salary(j, true), [4]);
      add("法定福利費", j => Math.round(salary(j, false) * 0.15), j => Math.round(salary(j, true) * 0.15));
      rationale = `対象${people}名、前年からの月額昇給3,000円/人を4月から給料手当に計上し、法定福利費を昇給額の15%で見積。確定は7月の労使合意で3,500円/人へ改定し、福利費も再計算。4月昇給は同額の明示確定、他の費用や売上を便乗して増やさない。`;
    } else if (category === 2) {
      program = `${assets[i]}の更新`;
      const purchase = (1200 + i * 120 + d * 60) * 1000;
      const preparation = 18000 + i * 1000 + d * 500;
      const oldRepair = 2000 + i * 100;
      add("固定資産減価償却費", j => j >= 6 ? purchase / 60 : 0, j => j >= 7 ? purchase * 0.9 / 60 : 0);
      add("修繕費", j => j >= 6 ? -oldRepair : 0, j => j >= 7 ? -oldRepair : 0);
      add("消耗品費", j => j === 5 ? preparation : 0, j => j === 6 ? preparation : 0);
      rationale = `取得価額${purchase}円、使用60か月、10月供用開始で月${purchase / 60}円を固定資産減価償却費へ計上。取得代金は損益へ二重計上せず備考だけに保持。旧設備の修繕費を供用開始後毎月${oldRepair}円削減、9月の準備消耗品${preparation}円。確定は納期が11月へ延期、取得見積10%減で月${purchase * 0.9 / 60}円、旧修繕削減も11月開始、準備費は10月へ移す。`;
    } else if (category === 3) {
      program = "燃料単価の上昇";
      const liters = (j: number) => 300 + i * 20 + d * 30 + (j === 3 ? 100 : j === 8 ? 80 : j === 11 ? 60 : 0);
      add("燃料油脂費", j => liters(j) * 15, j => liters(j) * (j >= 6 ? 18 : 15), [4]);
      rationale = `基準使用量${300 + i * 20 + d * 30}L/月、7月は100L・12月80L・3月60L追加。前年からの単価上昇15円/Lを燃料油脂費へ正額計上。確定は10月からの仕入先通知で18円/Lへ改定する。使用量の季節計画は維持し、売上・給料・助成を架空に追加しない。4月の確定は同額を明示する。`;
    } else {
      program = "電気契約料金の上昇";
      const kwh = (j: number) => 1000 + i * 100 + d * 50 + ([3, 4].includes(j) ? 300 : [8, 9].includes(j) ? 200 : 0);
      add("動力光熱費", j => j >= 3 ? kwh(j) * 3 : 0, j => j >= 5 ? kwh(j) * 4 : 0);
      rationale = `基準使用量${1000 + i * 100 + d * 50}kWh/月、7〜8月は冷房300kWh・12〜1月は暖房200kWh追加。前年からの追加単価3円/kWhを7月から動力光熱費へ正額計上。確定は契約更新が9月へ延期し追加単価4円/kWh、7〜8月は明示0で旧契約を継続する。売上・給料は変更しない。`;
    }
  } else if (e === 1) {
    program = "サービス料金改定";
    add("売上高", j => j >= 6 ? volume * 300 : 0, j => j >= 7 ? volume * 400 : 0);
    add("通信運搬費", j => j === 6 ? 2000 + i * 100 + d * 100 : 0, j => j === 7 ? 2000 + i * 100 + d * 100 : 0);
    rationale = `既存契約${volume}件/月、数量は変えず10月から前年比300円/件の料金差を売上高へ計上。原価は数量不変のため追加しない。通知郵送費${2000 + i * 100 + d * 100}円を開始月に計上。確定は顧客合意が11月に延期し400円/件へ改定、10月の売上・郵送費を明示0、通知を11月へ移す。改定前の増減は両予算とも全行0。`;
  } else if (e === 2) {
    program = "低採算業務の終了";
    const payroll = Math.round(base * 0.22);
    const rent = Math.round(base * 0.08);
    add("売上高", j => j >= 3 ? -base : 0, j => j >= 5 ? -base : 0);
    add("本支店売上原価", j => j >= 3 ? -Math.round(base * 0.75) : 0, j => j >= 5 ? -Math.round(base * 0.75) : 0);
    add("給料手当", j => j >= 3 ? -payroll : 0, j => j >= 5 ? -payroll : 0);
    add("賃借料", j => j >= 3 ? -rent : 0, j => j >= 5 ? -rent : 0);
    add("外注費", j => j === 3 ? 12000 + i * 500 : 0, j => j === 5 ? 10000 + i * 500 : 0);
    rationale = `7月に月商${base}円の低採算契約を終了。売上比で原価75%・給料22%・賃借料8%の計105%となる赤字契約。売上を減額し、原価・給料${payroll}円・賃借料${rent}円を削減して終了後は毎月${Math.round(base * 0.05)}円の赤字を解消。終了月の外注解約作業${12000 + i * 500}円は正額。確定は引継ぎのため9月終了へ延期し7〜8月を明示0、交渉で解約作業費を${10000 + i * 500}円へ減額。終了前の費用削減は計上しない。`;
  } else if (e === 3) {
    program = "繁忙期の受注増";
    const quantity = (j: number, confirmed: boolean) => volume + (j === 3 ? 5 : j === 8 ? 8 + (confirmed ? 6 : 0) : j === 11 ? 4 : 0);
    add("売上高", j => quantity(j, false) * 2000, j => quantity(j, true) * 2000, [4]);
    add("本支店売上原価", j => quantity(j, false) * 700, j => quantity(j, true) * 700);
    add("通信運搬費", j => quantity(j, false) * 120, j => quantity(j, true) * 120);
    add("臨時傭員費", j => quantity(j, false) * 200, j => quantity(j, true) * 200);
    rationale = `前年より毎月${volume}件増、7月5件・12月8件・3月4件の繁忙加算。1件の売上2,000円・原価700円・配送120円・臨時作業200円で数量に応じて計算。確定は12月の追加受注6件だけを4科目へ連動反映する。4月は数量が確定したため同額を明示し、その他の月は一次へ追従。`;
  } else if (e === 4) {
    program = "新規顧客の開拓";
    const contracts = (j: number, start: number) => j < start ? 0 : 5 + i + d + Math.floor((j - start) / 3);
    add("売上高", j => contracts(j, 3) * 5000, j => contracts(j, 4) * 5000);
    add("本支店売上原価", j => contracts(j, 3) * 1750, j => contracts(j, 4) * 1750);
    add("給料手当", j => j >= 3 ? 5000 + d * 1000 : 0, j => j >= 4 ? 5000 + d * 1000 : 0);
    add("宣伝広告費", j => j < 3 ? 0 : j === 3 ? 18000 + i * 500 : 2000, j => j < 4 ? 0 : j === 4 ? 18000 + i * 500 : 2000);
    add("営業外収益", j => j === 11 ? 5001 : 0);
    rationale = `7月に${5 + i + d}社で開始、3か月ごとに1社増、1社月額売上5,000円・原価1,750円。開始月の販促${18000 + i * 500}円、以後2,000円/月、給料${5000 + d * 1000}円/月、完了時3月に開拓助成5,001円。確定は契約開始が8月へ延期し7月全行を明示0、契約増加の四半期計画と初月販促も8月起点へ移す。助成の交付時期は変えない。`;
  } else if (e === 5) {
    program = "作業手順の改善";
    add("研修教育費", j => j === 0 ? 10000 + i * 1000 + d * 500 : 0, undefined, [4]);
    add("下払作業賃", j => j >= 2 ? -4000 - i * 300 - d * 200 : 0, j => j >= 3 ? -4000 - i * 300 - d * 200 : 0);
    add("給料手当", j => j >= 2 ? -3000 - i * 100 - d * 200 : 0, j => j >= 3 ? -2800 - i * 100 - d * 200 : 0);
    add("通信運搬費", j => j >= 2 ? -1251 : 0, j => j >= 3 ? -1251 : 0);
    add("営業外収益", j => j === 8 ? 12000 + i * 500 : 0, () => 0);
    rationale = `4月研修${10000 + i * 1000 + d * 500}円を投入し6月から外注作業${4000 + i * 300 + d * 200}円・給料${3000 + i * 100 + d * 200}円・通信1,251円/月を削減。一次は12月の改善助成${12000 + i * 500}円を見込む。確定は定着遅延で削減開始を7月へ移し6月を明示0、給料削減を${2800 + i * 100 + d * 200}円/月へ見直す。助成要件未達で12月助成も明示0。研修費は同額で確定する。`;
  } else {
    program = "担当業務の移管";
    const sign = d === 0 ? -1 : 1;
    const income = (j: number) => (40 + i * 8) * 1000 + (j + 1) * 1000;
    const counterparts = `${operation}・${program}・${d === 0 ? "西" : "東"}`;
    add("売上高", j => sign * income(j), j => j >= 3 ? sign * income(j) : 0);
    add("本支店売上原価", j => sign * Math.round(income(j) * 0.35), j => j >= 3 ? sign * Math.round(income(j) * 0.35) : 0);
    add("給料手当", () => sign * (5000 + i * 100), j => j >= 3 ? sign * (5000 + i * 100) : 0);
    add("通信運搬費", () => sign * (1000 + i * 50), j => j >= 3 ? sign * (1000 + i * 50) : 0);
    rationale = `相手施策「${counterparts}」と対になる同一業務の移管。部署AからBへ4月移管し、売上は4月${income(0)}円から毎月1,000円増、原価35%・給料${5000 + i * 100}円・通信${1000 + i * 50}円も同額で受け渡す。元は負、先は正。確定は引継ぎ完了が7月へ延期し4〜6月の全科目を両部署とも明示0。7月以降の受渡額と全体合計は維持する。`;
  }
  return { name: `${operation}・${program}・${region}`, note: `${region}側拠点（部署${d === 0 ? "A" : "B"}）の${operation}。${categoryName ? `展開区分は${categoryName}。` : ""}${rationale}`, categoryName, rows };
}
