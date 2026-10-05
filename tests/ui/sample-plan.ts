import { INITIAL_KINDS } from "../../Triadichrome-extension/src/core/kindMasterSchema";
import { INITIAL_PERIOD_TYPES } from "../../Triadichrome-extension/src/core/periodMasterSchema";
import { INITIAL_DEPARTMENTS } from "../../Triadichrome-extension/src/core/departmentSchema";
import { INITIAL_INDUSTRIES } from "../../Triadichrome-extension/src/core/industrySchema";
import { INITIAL_EXPANSIONS } from "../../Triadichrome-extension/src/core/expansionSchema";
import { changeAccountMaster } from "../../Triadichrome-extension/src/core/accountMaster";
import { changeAggregationMaster } from "../../Triadichrome-extension/src/core/aggregationMaster";
import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";
import { currentFiscalYear, initiativeMonths, readPlanContents, registerInitiative, type InitiativeRow } from "../../Triadichrome-extension/src/core/initiatives";

// Shared by the preview and the generated .triadic sample, using the app's own validation.
export async function createSamplePlan(fiscalYear = currentFiscalYear()): Promise<Uint8Array> {
  let bytes = await createTriadicDatabase();
  const kinds = (await readPlanContents(bytes)).kinds;
  if (kinds.length !== INITIAL_KINDS.length || kinds.some((item, index) => item.kindName !== INITIAL_KINDS[index]!.kindName)) throw new Error("種別マスタの初期データが一致しません。");
  const expansions = (await readPlanContents(bytes)).expansions;
  if (expansions.length !== INITIAL_EXPANSIONS.length || expansions.some((item, index) => item.expansionName !== INITIAL_EXPANSIONS[index]!.expansionName)) throw new Error("展開マスタの初期データが一致しません。");
  const periodTypes = (await readPlanContents(bytes)).periodTypes;
  if (periodTypes.length !== INITIAL_PERIOD_TYPES.length || periodTypes.some((item, index) => item.periodName !== INITIAL_PERIOD_TYPES[index]!.periodName)) throw new Error("期間マスタの初期データが一致しません。");
  const departments = (await readPlanContents(bytes)).departments;
  if (departments.length !== INITIAL_DEPARTMENTS.length || departments.some((item, index) => item.departmentName !== INITIAL_DEPARTMENTS[index]!.departmentName)) throw new Error("部署マスタの初期データが一致しません。");
  const industries = (await readPlanContents(bytes)).industries;
  if (industries.length !== INITIAL_INDUSTRIES.length || industries.some((item, index) => item.industryName !== INITIAL_INDUSTRIES[index]!.industryName)) throw new Error("業種マスタの初期データが一致しません。");
  const accounts = new Map((await readPlanContents(bytes)).accounts.map(account => [account.accountName, account.id]));
  for (const [accountCode, accountName] of [["001", "未所属費用"], ["599", "削除確認用科目"]]) {
    const changed = await changeAccountMaster(bytes, { type: "add", accountCode: accountCode!, accountName: accountName!, accountType: "expense" });
    bytes = changed.bytes;
    accounts.set(accountName!, changed.accounts.find(account => account.accountCode === accountCode)!.id);
  }
  bytes = await changeAggregationMaster(bytes, { type: "add", name: "編集・削除確認用集計" });

  const row = (name: string, amounts: InitiativeRow["amounts"]): InitiativeRow => ({ accountId: accounts.get(name)!, amounts });
  const annual = (name: string, amount: number, growth = 0): InitiativeRow => row(name,
    Object.fromEntries(initiativeMonths.map((month, index) => [month, String(amount + index * growth)])));
  const add = async (name: string, note: string, rows: InitiativeRow[], year = fiscalYear) => {
    const codes: Record<string, string> = {
      "既存商品の販売拡大": "5", "保守サービスの新規契約": "5", "季節キャンペーン": "5",
      "通信運搬費と消耗品費の削減": "1", "サブスクリプション事業の拡大": "2",
      "設備更新と償却費の見直し": "1", "助成金の受入れ": "9",
      "ゼロと相殺の確認": "8", "未確定施策の入力準備": "8",
    };
    const expansionId = expansions.find(item => item.expansionCode === (codes[name] ?? "5"))!.id;
    bytes = await registerInitiative(bytes, { name, note, expansionId, industryId: name === "助成金の受入れ" ? null : industries[(await readPlanContents(bytes)).initiatives.filter(item => item.industryId != null).length % industries.length]!.id, periodTypeId: periodTypes[(await readPlanContents(bytes)).initiatives.length % periodTypes.length]!.id, departmentId: name === "助成金の受入れ" ? null : departments[(await readPlanContents(bytes)).initiatives.length % departments.length]!.id, fiscalYear: String(year), rows });
  };

  await add("既存商品の販売拡大", "全12か月の増減計画。同じ売上高の2行は直販と代理店販売です。", [
    annual("売上高", 120000, 5000), annual("売上高", 30000, 1000), annual("本支店売上原価", 60000, 2500),
    annual("宣伝広告費", 8000), annual("旅費", 3000), annual("営業外収益", 125.501),
  ]);
  await add("保守サービスの新規契約", "7月開始。4〜6月は未入力、翌年3月まで継続します。", [
    row("グループ売上高", { 7: "80000", 8: "80000", 9: "100000", 10: "100000", 11: "120000", 12: "120000", 1: "140000", 2: "140000", 3: "160000" }),
    row("店内売上原価", { 7: "30000", 8: "30000", 9: "40000", 10: "40000", 11: "50000", 12: "50000", 1: "60000", 2: "60000", 3: "70000" }),
    row("給料手当", { 7: "20000", 8: "20000", 9: "20000", 10: "20000", 11: "20000", 12: "20000", 1: "20000", 2: "20000", 3: "20000" }),
  ]);
  await add("季節キャンペーン", "夏季と年末の単月施策。未入力月と入力済みのゼロを比較できます。", [
    row("売上高", { 6: "50000", 7: "75000", 12: "180000", 1: "0" }),
    row("本支店売上原価", { 6: "20000", 7: "30000", 12: "72000", 1: "0" }),
    row("宣伝広告費", { 5: "15000", 6: "25000", 11: "40000" }),
  ]);
  await add("通信運搬費と消耗品費の削減", "費用の負数は削減額です。入力の小数と整数千円の表示を比較できます。3月は1円の端数を保持します。", [
    annual("通信運搬費", -2500.5), row("消耗品費", { ...annual("消耗品費", -1250.25).amounts, 3: "-1250.251" }),
  ]);
  await add("サブスクリプション事業の拡大", "毎月の増加と先行費用を含む計画です。", [
    annual("本支店売上高", 40000, 10000), annual("店内売上原価", 15000, 2000),
    annual("給料手当", 30000), annual("賃借料", 10000),
  ]);
  await add("設備更新と償却費の見直し", "10月から新しい設備の償却を開始し、旧設備分を減額します。", [
    row("固定資産減価償却費", { 10: "18000", 11: "18000", 12: "18000", 1: "18000", 2: "18000", 3: "18000" }),
    row("固定資産減価償却費", { 10: "-5000", 11: "-5000", 12: "-5000", 1: "-5000", 2: "-5000", 3: "-5000" }),
    row("消耗品費", { 9: "25000" }),
  ]);
  await add("助成金の受入れ", "利益属性の科目。9月と翌3月だけ計上します。業種・部署の未選択を確認できます。", [row("営業外収益", { 9: "100000", 3: "50000" })]);
  await add("ゼロと相殺の確認", "4月は明示的なゼロ、5月は同じ科目の正負が相殺、6月以降の空欄は0として保存されます。", [
    row("売上高", { 4: "0", 5: "12000.5" }), row("売上高", { 5: "-12000.5" }),
  ]);
  await add("未確定施策の入力準備", "全月0でも科目は使用中です。未所属費用を集計へ移す操作も試せます。", [row("未所属費用", {})]);

  for (const [year, label, sales, cost] of [[fiscalYear - 1, "前年度", 70000, 25000], [fiscalYear + 1, "次年度", 150000, 55000]] as const) {
    await add(`${label}の販売施策`, "年度切り替え用の増減計画。総原価表の前年合計値ではありません。", [annual("売上高", sales), annual("本支店売上原価", cost)], year);
    await add(`${label}のサービス施策`, "別年度の施策が当年度の集計に混ざらないことを確認できます。", [annual("グループ売上高", sales / 2), annual("給料手当", 15000)], year);
  }
  const database = await openTriadicDatabase(bytes);
  try {
    // Stable fixture timestamps keep regeneration independent of the wall clock.
    const timestamp = `${String(fiscalYear).padStart(4, "0")}-04-01T00:00:00.000Z`;
    database.run("UPDATE budgets SET created_at = ?, updated_at = ?", [timestamp, timestamp]);
    return database.export();
  } finally { database.close(); }
}
