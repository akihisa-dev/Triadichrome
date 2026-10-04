import { changeAccountMaster } from "../../Triadichrome-extension/src/core/accountMaster";
import { changeAggregationMaster } from "../../Triadichrome-extension/src/core/aggregationMaster";
import { type AggregationMember } from "../../Triadichrome-extension/src/core/aggregations";
import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/triadicDatabase";
import { currentFiscalYear, initiativeMonths, readPlanContents, registerInitiative, type InitiativeRow } from "../../Triadichrome-extension/src/core/initiatives";

// Shared by the preview and the generated .triadic sample, using the app's own validation.
export async function createSamplePlan(fiscalYear = currentFiscalYear()): Promise<Uint8Array> {
  let bytes = await createTriadicDatabase();
  const accounts = new Map<string, number>();
  for (const [accountCode, accountName, accountType] of [
    ["001", "商品売上", "sales"], ["110", "保守サービス売上", "sales"], ["120", "利用料売上", "sales"],
    ["201", "商品仕入", "cost"], ["210", "外注原価", "cost"],
    ["501", "給与手当", "expense"], ["510", "広告宣伝費", "expense"], ["520", "旅費交通費", "expense"],
    ["530", "通信費", "expense"], ["540", "地代家賃", "expense"], ["550", "減価償却費", "expense"],
    ["560", "消耗品費", "expense"], ["901", "受取利息", "profit"], ["910", "助成金収入", "profit"],
    ["580", "未所属費用", "expense"], ["599", "削除確認用科目", "expense"],
  ] as const) {
    const changed = await changeAccountMaster(bytes, { type: "add", accountCode, accountName, accountType });
    bytes = changed.bytes;
    accounts.set(accountName, changed.accounts.find(account => account.accountCode === accountCode)!.id);
  }

  for (const name of ["商品売上小計", "サービス売上小計", "売上原価集計", "人件費集計", "販管費集計", "営業外収益", "編集・削除確認用集計"]) {
    bytes = await changeAggregationMaster(bytes, { type: "add", name });
  }
  const groups = new Map((await readPlanContents(bytes)).aggregations.map(group => [group.name, group.id]));
  const account = (name: string, sign: 1 | -1 = 1): AggregationMember => ({ kind: "account", id: accounts.get(name)!, sign });
  const group = (name: string, sign: 1 | -1 = 1): AggregationMember => ({ kind: "group", id: groups.get(name)!, sign });
  const definitions: [string, AggregationMember[]][] = [
    ["商品売上小計", [account("商品売上")]],
    ["サービス売上小計", [account("保守サービス売上"), account("利用料売上")]],
    ["売上原価集計", [account("商品仕入"), account("外注原価")]],
    ["人件費集計", [account("給与手当")]],
    ["販管費集計", ["広告宣伝費", "旅費交通費", "通信費", "地代家賃", "減価償却費", "消耗品費"].map(name => account(name))],
    ["営業外収益", [account("受取利息"), account("助成金収入")]],
    ["売上集計", [group("商品売上小計"), group("サービス売上小計"), group("売上原価集計", -1)]],
    ["費用集計", [group("人件費集計"), group("販管費集計")]],
    ["営業利益", [group("売上集計"), group("費用集計", -1)]],
    ["経常利益", [group("営業利益"), group("営業外収益")]],
  ];
  for (const [name, members] of definitions) {
    bytes = await changeAggregationMaster(bytes, { type: "update", id: groups.get(name)!, name, members });
  }

  const row = (name: string, amounts: InitiativeRow["amounts"]): InitiativeRow => ({ accountId: accounts.get(name)!, amounts });
  const annual = (name: string, amount: number, growth = 0): InitiativeRow => row(name,
    Object.fromEntries(initiativeMonths.map((month, index) => [month, String(amount + index * growth)])));
  const add = async (name: string, note: string, rows: InitiativeRow[], year = fiscalYear) => {
    bytes = await registerInitiative(bytes, { name, note, fiscalYear: String(year), rows });
  };

  await add("既存商品の販売拡大", "全12か月の増減計画。同じ商品売上の2行は直販と代理店販売です。", [
    annual("商品売上", 120000, 5000), annual("商品売上", 30000, 1000), annual("商品仕入", 60000, 2500),
    annual("広告宣伝費", 8000), annual("旅費交通費", 3000), annual("受取利息", 125.5),
  ]);
  await add("保守サービスの新規契約", "7月開始。4〜6月は未入力、翌年3月まで継続します。", [
    row("保守サービス売上", { 7: "80000", 8: "80000", 9: "100000", 10: "100000", 11: "120000", 12: "120000", 1: "140000", 2: "140000", 3: "160000" }),
    row("外注原価", { 7: "30000", 8: "30000", 9: "40000", 10: "40000", 11: "50000", 12: "50000", 1: "60000", 2: "60000", 3: "70000" }),
    row("給与手当", { 7: "20000", 8: "20000", 9: "20000", 10: "20000", 11: "20000", 12: "20000", 1: "20000", 2: "20000", 3: "20000" }),
  ]);
  await add("季節キャンペーン", "夏季と年末の単月施策。未入力月と入力済みのゼロを比較できます。", [
    row("商品売上", { 6: "50000", 7: "75000", 12: "180000", 1: "0" }),
    row("商品仕入", { 6: "20000", 7: "30000", 12: "72000", 1: "0" }),
    row("広告宣伝費", { 5: "15000", 6: "25000", 11: "40000" }),
  ]);
  await add("通信費と消耗品費の削減", "費用の負数は削減額です。小数の保存と利益への加算を確認できます。", [
    annual("通信費", -2500.5), annual("消耗品費", -1250.25),
  ]);
  await add("サブスクリプション事業の拡大", "毎月の増加と先行費用を含む計画です。", [
    annual("利用料売上", 40000, 10000), annual("外注原価", 15000, 2000),
    annual("給与手当", 30000), annual("地代家賃", 10000),
  ]);
  await add("設備更新と償却費の見直し", "10月から新しい設備の償却を開始し、旧設備分を減額します。", [
    row("減価償却費", { 10: "18000", 11: "18000", 12: "18000", 1: "18000", 2: "18000", 3: "18000" }),
    row("減価償却費", { 10: "-5000", 11: "-5000", 12: "-5000", 1: "-5000", 2: "-5000", 3: "-5000" }),
    row("消耗品費", { 9: "25000" }),
  ]);
  await add("助成金の受入れ", "利益属性の科目。9月と翌3月だけ計上します。", [row("助成金収入", { 9: "100000", 3: "50000" })]);
  await add("ゼロと相殺の確認", "4月は明示的なゼロ、5月は同じ科目の正負が相殺、6月以降は空欄です。", [
    row("商品売上", { 4: "0", 5: "12000.5" }), row("商品売上", { 5: "-12000.5" }),
  ]);
  await add("未確定施策の入力準備", "全月空欄でも科目は使用中です。未所属費用を集計へ移す操作も試せます。", [row("未所属費用", {})]);

  for (const [year, label, sales, cost] of [[fiscalYear - 1, "前年度", 70000, 25000], [fiscalYear + 1, "次年度", 150000, 55000]] as const) {
    await add(`${label}の販売施策`, "年度切り替え用の増減計画。総原価表の前年合計値ではありません。", [annual("商品売上", sales), annual("商品仕入", cost)], year);
    await add(`${label}のサービス施策`, "別年度の施策が当年度の集計に混ざらないことを確認できます。", [annual("保守サービス売上", sales / 2), annual("給与手当", 15000)], year);
  }
  const database = await openTriadicDatabase(bytes);
  try {
    // Stable fixture timestamps keep regeneration independent of the wall clock.
    const timestamp = `${String(fiscalYear).padStart(4, "0")}-04-01T00:00:00.000Z`;
    database.run("UPDATE budgets SET created_at = ?, updated_at = ?", [timestamp, timestamp]);
    return database.export();
  } finally { database.close(); }
}
