import { orderedMasterRows } from "../domain/masterRows";
import { saveMasterOrder } from "./masterPresentation";
import { type Database } from "./sqliteRuntime";
import { type AccountType } from "../domain/accountTypes";

/** Approved names, single codes and display order. No source-sheet classifications. */
export const DEFAULT_ACCOUNTS: readonly (readonly [string, string, AccountType])[] = [
  ["401", "売上高", "sales"], ["403", "グループ売上高", "sales"],
  ["405", "本支店売上高", "sales"], ["407", "店内売上高", "sales"],
  ["593", "本支店売上原価", "cost"], ["595", "店内売上原価", "cost"],
  ["537", "旅費", "expense"], ["549", "通信運搬費", "expense"],
  ["539", "交際費", "expense"], ["541", "会議費", "expense"],
  ["551", "動力光熱費", "expense"], ["553", "燃料油脂費", "expense"],
  ["555", "消耗品費", "expense"], ["573", "修繕費", "expense"],
  ["554", "タイヤチューブ費", "expense"], ["575", "通行乗船料", "expense"],
  ["557", "下払運賃", "expense"], ["559", "下払鉄道運賃", "expense"],
  ["561", "継配費", "expense"], ["563", "下払作業賃", "expense"],
  ["565", "再保管料", "expense"], ["571", "外注費", "expense"],
  ["579", "事故費", "expense"], ["569", "ＥＤＰ処理料", "expense"],
  ["585", "雑費", "expense"], ["544", "研修教育費", "expense"],
  ["545", "諸負担金", "expense"], ["583", "諸手数料", "expense"],
  ["577", "港・貨物費", "expense"], ["543", "寄付金", "expense"],
  ["547", "宣伝広告費", "expense"], ["548", "研究開発費", "expense"],
  ["519", "期首商品棚卸高", "expense"], ["523", "商品仕入高", "expense"],
  ["526", "期末商品棚卸高", "expense"], ["670", "商事物流費", "expense"],
  ["663", "貸倒引当金繰入額", "expense"], ["665", "貸倒損失", "expense"],
  ["661", "販売手数料", "expense"], ["525", "商品評価・減耗損", "expense"],
  ["501", "給料手当", "expense"], ["502", "役員報酬", "expense"],
  ["503", "賞与", "expense"], ["505", "退職金", "expense"],
  ["513", "法定福利費", "expense"], ["515", "厚生福利費", "expense"],
  ["517", "臨時傭員費", "expense"], ["527", "固定資産減価償却費", "expense"],
  ["528", "リース資産償却費", "expense"], ["529", "保険料", "expense"],
  ["530", "除去債務利息費用", "expense"], ["533", "賃借料", "expense"],
  ["534", "借船料", "expense"], ["535", "リース料", "expense"],
  ["531", "租税公課", "expense"], ["713", "営業外収益", "profit"],
  ["731", "営業外費用", "expense"],
];

/** Only new files receive defaults; migration must never replace user masters. */
export function seedDefaultCostMaster(database: Database): void {
  DEFAULT_ACCOUNTS.forEach(([code, name, attribute]) => database.run(
    "INSERT INTO accounts (code, name, attribute) VALUES (?, ?, ?)",
    [code, name, attribute],
  ));
  const ids = new Map((database.exec("SELECT code, id FROM accounts")[0]?.values ?? []).map(([code, id]) => [String(code), Number(id)]));
  const definitions: [number, string, string, (readonly ["account" | "group", number, 1 | -1])[]][] = [];
  const accounts = (from: string, to: string) => {
    const first = DEFAULT_ACCOUNTS.findIndex(([code]) => code === from);
    const last = DEFAULT_ACCOUNTS.findIndex(([code]) => code === to);
    return DEFAULT_ACCOUNTS.slice(first, last + 1).map(([code]) => ["account", ids.get(code)!, 1] as const);
  };
  const groups = (...members: [number, 1 | -1][]) => members.map(([id, sign]) => ["group", id, sign] as const);
  definitions.push(
    [5, "社外売上小計", "小計", accounts("401", "403")],
    [6, "社内売上小計", "小計", accounts("405", "407")],
    [7, "売上合計", "合計", groups([5, 1], [6, 1])],
    [8, "売上原価小計", "小計", accounts("593", "595")],
    [1, "売上集計", "社内控除後売上", groups([7, 1], [8, -1])],
    [9, "管理可能費小計", "小計", accounts("537", "541")],
    [10, "その他変動費小計", "小計", accounts("551", "525")],
    [11, "変動費合計", "合計", groups([9, 1], [10, 1])],
    [12, "人件費小計", "小計", accounts("501", "517")],
    [13, "その他固定費小計", "小計", accounts("527", "531")],
    [14, "固定費合計", "合計", groups([12, 1], [13, 1])],
    [2, "費用集計", "原価計", groups([11, 1], [14, 1])],
    [3, "営業利益", "営業利益", groups([1, 1], [2, -1])],
    [15, "営業外収益計", "営業外収益計", [["account", ids.get("713")!, 1], ["account", ids.get("731")!, -1]]],
    [4, "経常利益", "経常利益", groups([3, 1], [15, 1])],
  );
  for (const [id, name, displayName, members] of definitions) {
    database.run("INSERT INTO aggregation_groups (id, name, display_name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name", [id, name, displayName]);
    members.forEach(([kind, memberId, sign], position) => database.run(
      "INSERT INTO aggregation_members (parent_id, account_id, group_id, sign, position) VALUES (?, ?, ?, ?, ?)",
      [id, kind === "account" ? memberId : null, kind === "group" ? memberId : null, sign, position],
    ));
  }
  const accountsForOrder = DEFAULT_ACCOUNTS.map(([accountCode, accountName, accountType]) => ({id:ids.get(accountCode)!, accountCode, accountName, accountType, inUse:false}));
  const groupsForOrder = definitions.map(([id,name,displayName,members]) => ({id,name,displayName,required:null,
    members:members.map(([kind,id,sign]) => ({kind,id,sign}))}));
  saveMasterOrder(database,orderedMasterRows(accountsForOrder,groupsForOrder));
}
