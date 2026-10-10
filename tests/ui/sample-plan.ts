import { PORTFOLIO_COUNT, portfolioScenario } from "./sample-portfolio";
// 集計所属順は現行DDLの非負・安全な整数で生成する。不正型・値域・採番境界の拒否は tests/aggregation-positions.mjs の合成DBで確認する。
import { changeExpansionCategoryMaster } from "../../Triadichrome-extension/src/core/storage/expansionCategoryMaster";
import { changeExpansionMaster } from "../../Triadichrome-extension/src/core/storage/expansionMaster";
// Excel出力では選択した表と条件を保ち、従来の三表と計算元、および基本関数による金額の再計算を確認する。
import { editDatabase } from "../../Triadichrome-extension/src/core/storage/transaction";
import { trackHistoryChange, recordDataHistory } from "../../Triadichrome-extension/src/core/storage/dataHistory";
import { savePreviousAmounts } from "../../Triadichrome-extension/src/core/storage/settings";
import { INITIAL_KINDS } from "../../Triadichrome-extension/src/core/domain/kinds";
import { INITIAL_PERIOD_TYPES } from "../../Triadichrome-extension/src/core/storage/periodMasterSchema";
import { INITIAL_DEPARTMENTS } from "../../Triadichrome-extension/src/core/storage/departmentSchema";
import { INITIAL_INDUSTRIES } from "../../Triadichrome-extension/src/core/storage/industrySchema";
import { INITIAL_EXPANSIONS } from "../../Triadichrome-extension/src/core/storage/expansionSchema";
import { changeDepartmentMaster } from "../../Triadichrome-extension/src/core/storage/departmentMaster";
import { changeAccountMaster } from "../../Triadichrome-extension/src/core/storage/accountMaster";
import { changeAggregationMaster } from "../../Triadichrome-extension/src/core/storage/aggregationMaster";
import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";
import { currentFiscalYear, initiativeMonths } from "../../Triadichrome-extension/src/core/domain/calendar";
import { readPlanContents } from "../../Triadichrome-extension/src/core/storage/readPlan";
import { registerInitiative, updateInitiative } from "../../Triadichrome-extension/src/core/storage/initiatives";
import { type InitiativeEntryDraft, type InitiativeRow } from "../../Triadichrome-extension/src/core/domain/plan";

import { amountItems, amountItemComposition } from "../../Triadichrome-extension/src/core/domain/amountItems";
import { accountTypes } from "../../Triadichrome-extension/src/core/domain/accountTypes";

// All amount literals are in thousands of yen; 0.001 represents one yen.
// Previous amounts span every industry/department pair; varying sales verify full totals and department/industry filters.
// Shared by the preview and the generated .triadic sample, using the app's own validation.
export const LARGE_SAMPLE_INITIATIVES = PORTFOLIO_COUNT;
export const SAMPLE_MAX_BYTES = 50_000_000;

export async function createSamplePlan(fiscalYear = currentFiscalYear(), large = false): Promise<Uint8Array> {
  let bytes = await createTriadicDatabase(fiscalYear);
  for (const categoryName of ["確認用：未割当区分"]) bytes = await changeExpansionCategoryMaster(bytes, { type: "add", categoryName });
  const categoryIdsByName = new Map((await readPlanContents(bytes)).expansionCategories.map(item => [item.categoryName, item.id]));
  const sharedCategory = categoryIdsByName.get("設備投資")!;
  for (const [id, categoryIds] of [[2, [sharedCategory]], [5, [sharedCategory]]] as const) {
    const expansion = (await readPlanContents(bytes)).expansions.find(item => item.id === id)!;
    bytes = await changeExpansionMaster(bytes, { type: "update", id, expansionCode: expansion.expansionCode, expansionName: expansion.expansionName, categoryIds: [...categoryIds] });
  }
  if (Object.values(accountTypes).join("・") !== "売上・売上原価・費用・利益") throw new Error("科目属性マスタの固定4件が一致しません。");
  if (amountItems.map(item => item.name).join("・") !== "売上・費用・利益" || amountItems.map(amountItemComposition).join(";") !== "売上 − 売上原価;費用;売上 − 売上原価 − 費用 ＋ 利益") throw new Error("金額項目マスタの固定項目・構成が一致しません。");
  const kinds = (await readPlanContents(bytes)).kinds;
  if (kinds.length !== INITIAL_KINDS.length || kinds.some((item, index) => item.kindName !== INITIAL_KINDS[index]!.kindName)) throw new Error("種別マスタの初期データが一致しません。");
  if (kinds.length !== 2) throw new Error("予算の2種別を確認できません。");
  const expansions = (await readPlanContents(bytes)).expansions;
  if (expansions.length !== INITIAL_EXPANSIONS.length || expansions.some((item, index) => item.expansionName !== INITIAL_EXPANSIONS[index]!.expansionName)) throw new Error("展開マスタの初期データが一致しません。");
  const periodTypes = (await readPlanContents(bytes)).periodTypes;
  if (periodTypes.length !== INITIAL_PERIOD_TYPES.length || periodTypes.some((item, index) => item.periodName !== INITIAL_PERIOD_TYPES[index]!.periodName)) throw new Error("期間マスタの初期データが一致しません。");
  const departments = (await readPlanContents(bytes)).departments;
  if (departments.length !== INITIAL_DEPARTMENTS.length || departments.some((item, index) => item.departmentName !== INITIAL_DEPARTMENTS[index]!.departmentName)) throw new Error("部署マスタの初期データが一致しません。");
  const industries = (await readPlanContents(bytes)).industries;
  if (departments.some(item => item.industryIds.length !== INITIAL_INDUSTRIES.length || INITIAL_INDUSTRIES.some(industry => !item.industryIds.includes(industry.id)))) throw new Error("部署の複数業種の対応が一致しません。");
  if (industries.length !== INITIAL_INDUSTRIES.length || industries.some((item, index) => item.industryName !== INITIAL_INDUSTRIES[index]!.industryName)) throw new Error("業種マスタの初期データが一致しません。");
  const accounts = new Map((await readPlanContents(bytes)).accounts.map(account => [account.accountName, account.id]));
  for (const [accountCode, accountName] of [["001", "未所属費用"], ["599", "削除確認用科目"]]) {
    const changed = await changeAccountMaster(bytes, { type: "add", accountCode: accountCode!, accountName: accountName!, accountType: "expense", ...(accountCode === "599" ? { displayName: "表示名確認用" } : {}) });
    bytes = changed.bytes;
    accounts.set(accountName!, changed.accounts.find(account => account.accountCode === accountCode)!.id);
  }
  bytes = await changeAggregationMaster(bytes, { type: "add", name: "編集・削除確認用集計" });

  const row = (name: string, amounts: InitiativeRow["amounts"]): InitiativeRow => ({ accountId: accounts.get(name)!, amounts });
  const annual = (name: string, amount: number, growth = 0): InitiativeRow => row(name,
    Object.fromEntries(initiativeMonths.map((month, index) => [month, String(amount + index * growth)])));
  const add = async (name: string, note: string, rows: InitiativeRow[], periodTypeId?: number) => {
    const codes: Record<string, string> = {
      "既存商品の販売拡大": "5", "保守サービスの新規契約": "5", "季節キャンペーン": "5",
      "通信運搬費と消耗品費の削減": "1", "サブスクリプション事業の拡大": "2",
      "設備更新と償却費の見直し": "1", "助成金の受入れ": "9",
      "ゼロと相殺の確認": "8", "未確定施策の入力準備": "8",
    };
    const expansionId = expansions.find(item => item.expansionCode === (codes[name] ?? "5"))!.id;
    // Choose a meaningful period instead of cycling incompatible start-month rules.
    bytes = await registerInitiative(bytes, { name, note, expansionId, expansionCategoryId: name === "既存商品の販売拡大" ? sharedCategory : null, industryId: industries[(await readPlanContents(bytes)).initiatives.filter(item => item.industryId != null).length % industries.length]!.id, periodTypeId: name === "未確定施策の入力準備" ? null : periodTypeId ?? periodTypes.find(item => item.periodName === "新規")!.id, departmentId: departments[(await readPlanContents(bytes)).initiatives.length % departments.length]!.id, fiscalYear: String(fiscalYear), rows: rows.map((row,index) => ({ ...row, id: `sample:${name}:${index}` })) });
  };

  await add("既存商品の販売拡大", "直販と代理店の販路を増やす年間計画。直販売上は4月120千円から毎月5千円増、代理店は30千円から毎月1千円増。原価・広告・出張費と販売奨励金を計上。確定は4月130、10月170、11月0に見直す。", [
    { ...annual("売上高", 120, 5), overrides: { 2: { 4: "130", 10: "170", 11: "0" } } }, annual("売上高", 30, 1), annual("本支店売上原価", 60, 2.5),
    annual("宣伝広告費", 8), annual("旅費", 3), annual("営業外収益", 0.125),
  ]);
  await add("保守サービスの新規契約", "7月から保守契約を開始し、契約社数増に応じて売上・原価を段階的に増やす。月20千円の人員費を追加。確定では開始が8月へ延期し、7月を全科目で明示0にする。", [
    { ...row("グループ売上高", { 7: "80", 8: "80", 9: "100", 10: "100", 11: "120", 12: "120", 1: "140", 2: "140", 3: "160" }), overrides: { 2: { 7: "0" } } },
    { ...row("店内売上原価", { 7: "30", 8: "30", 9: "40", 10: "40", 11: "50", 12: "50", 1: "60", 2: "60", 3: "70" }), overrides: { 2: { 7: "0" } } },
    { ...row("給料手当", { 7: "20", 8: "20", 9: "20", 10: "20", 11: "20", 12: "20", 1: "20", 2: "20", 3: "20" }), overrides: { 2: { 7: "0" } } },
  ]);
  await add("季節キャンペーン", "夏季と年末の販促。5・6月および11月の広告を先行投入し、6・7・12月の受注を増やす。翌1月は増収0を計画する。", [
    row("売上高", { 6: "50", 7: "75", 12: "180", 1: "0" }),
    row("本支店売上原価", { 6: "20", 7: "30", 12: "72", 1: "0" }),
    row("宣伝広告費", { 5: "15", 6: "25", 11: "40" }),
  ]);
  await add("通信運搬費と消耗品費の削減", "通信契約見直しで毎月2.5千円、消耗品の共同調達で毎月1.25千円を削減。3月は追加1円の精算を含む。売上を増やさず費用を減らす。", [
    annual("通信運搬費", -2.5), row("消耗品費", { ...annual("消耗品費", -1.25).amounts, 3: "-1.251" }),
  ]);
  await add("サブスクリプション事業の拡大", "継続契約を毎月積み上げ、売上40千円から月10千円ずつ増やす。原価は15千円から月2千円増、担当者の給与30千円と賃借料10千円を負担する。", [
    annual("本支店売上高", 40, 10), annual("店内売上原価", 15, 2),
    annual("給料手当", 30), annual("賃借料", 10),
  ]);
  await add("設備更新と償却費の見直し", "9月に25千円の消耗品を購入し、10月から新設備の償却18千円を開始。旧設備の償却5千円を同時に減額する。", [
    row("固定資産減価償却費", { 10: "18", 11: "18", 12: "18", 1: "18", 2: "18", 3: "18" }),
    row("固定資産減価償却費", { 10: "-5", 11: "-5", 12: "-5", 1: "-5", 2: "-5", 3: "-5" }),
    row("消耗品費", { 9: "25" }),
  ]);
  await add("助成金の受入れ", "事業移管に伴う支援金を9月100千円、翌3月50千円で受け入れる。売上・費用と分けて営業外収益へ計上する。", [row("営業外収益", { 9: "100", 3: "50" })]);
  await add("ゼロと相殺の確認", "5月の請求12.5千円と同額の値引きで売上増減0。4月は明示0、その他の空欄は0として保存。明細には根拠となる正負の行を残す。", [
    row("売上高", { 4: "0", 5: "12.5" }), row("売上高", { 5: "-12.5" }),
  ]);
  await add("未確定施策の入力準備", "効率化案は検討中のため期間未選択・全月0。未所属費用の科目行を残し、金額決定後の入力と集計所属の変更を試せる準備状態。", [row("未所属費用", {})]);

  await add("確定予算の手修正", "年間の販路追加を月100千円で見込む。確定では4月を120へ上方修正し、5月は契約未成立のため明示0とする。", [{ ...annual("売上高", 100), overrides: { 2: { 4: "120", 5: "0" } } }]);
  await add("確定予算の下期調整", "月100千円の継続受注に、10月だけ追加50千円を確定。上期600、下期650、通期1250千円となる単月の見直し。", [{ ...annual("売上高", 100), overrides: { 2: { 10: "150" } } }]);
  await add("確定予算のゼロ固定", "グループ取引を月100千円で計画。確定4月は90、10月は取引延期で0。一次の変更へ追従する月と固定する月を区別する。", [{ ...annual("グループ売上高", 100), overrides: { 2: { 10: "0", 4: "90" } } }]);
  await add("科目変更と削除の確認", "稟議前の業務改善案。未所属費用と売上高を全月0で準備し、金額のない行の科目変更・削除・追加を試す。", [row("未所属費用", {}), row("売上高", {})]);
  await add("期間差の開始年月確認", "前年10月開始契約の効果が4〜9月に残る。前年条件との差10千円と調整-10千円を別行で記録。確定では10月も延長し前年11月開始として判定する。", [10, -10].map(amount => ({
    ...row("売上高", Object.fromEntries([4, 5, 7, 8, 9].map(month => [month, String(amount)]))),
    overrides: { 2: { 10: String(amount) } },
  })), periodTypes.find(item => item.periodName === "期間差")!.id);
  for (const [index, industry] of industries.entries()) {
    for (const [departmentIndex, department] of departments.entries()) {
      bytes = await savePreviousAmounts(bytes, { industryId: industry.id, departmentId: department.id, rows: [
        annual("売上高", 1000 + index * 100 + departmentIndex * 10),
        row("グループ売上高", { 4: "125.125", 5: "-20.001", 6: "0", 3: "0.001" }), annual("本支店売上原価", 400), annual("給料手当", 200), annual("営業外収益", 10),
      ].map(row => ({ accountId: row.accountId!, amounts: row.amounts })) });
    }
  }
  if (large) {
    // Insert the finite scenario catalog in one production transaction, with final schema/data validation.
    const scenarios = expansions.flatMap((expansion, e) => industries.flatMap((industry, i) => departments.map((department, d) => ({
      ...portfolioScenario(e, i, d, accounts), expansion, industry, department,
    }))));
    bytes = (await editDatabase(bytes, database => {
      const firstOrder = Number(database.exec("SELECT MAX(sort_order) + 1 FROM initiatives")[0]!.values[0]![0]);
      scenarios.forEach((scenario, index) => {
        database.run("INSERT INTO initiatives (name,note,expansion_id,expansion_category_id,industry_id,department_id,period_type_id,sort_order) VALUES (?,?,?,?,?,?,?,?)",
          [scenario.name,scenario.note,scenario.expansion.id,scenario.categoryName === null ? null : categoryIdsByName.get(scenario.categoryName)!,scenario.industry.id,scenario.department.id,periodTypes.find(item => item.periodName === "新規")!.id,firstOrder+index]);
        const id = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
        scenario.rows.forEach((row, position) => {
          const rowId = `portfolio:${index}:${position}`;
          database.run("INSERT INTO initiative_rows (id,initiative_id,account_id,sort_order) VALUES (?,?,?,?)", [rowId,id,row.accountId!,position]);
          for (const month of initiativeMonths) database.run("INSERT INTO initiative_amounts (row_id,kind_id,month,amount_yen) VALUES (?,?,?,?)", [rowId,1,month,Math.round(Number(row.amounts[month])*1000)]);
          for (const [month, amount] of Object.entries(row.overrides?.[2] ?? {})) database.run("INSERT INTO initiative_amounts (row_id,kind_id,month,amount_yen) VALUES (?,?,?,?)", [rowId,2,Number(month),Math.round(Number(amount)*1000)]);
        });
      });
    })).bytes;
  }
  if (large) {
    // Unused departments demonstrate candidate filtering without changing any totals.
    // Keep a new draft with the multiple-industry department, leave industry unselected,
    // then save membership [1]: industry 1 must be selected on return, retaining amounts.
    // A failed membership save must retain the saved membership and draft.
    bytes = await changeDepartmentMaster(bytes, { type: "add", departmentName: "複数業種確認部署", industryIds: [1, 2] });
    bytes = await changeDepartmentMaster(bytes, { type: "add", departmentName: "単一業種確認部署", industryIds: [3] });
  }
  const timestamp = `${String(fiscalYear).padStart(4, "0")}-04-01T00:00:00.000Z`;
  const stable = async (input: Uint8Array) => {
    const database = await openTriadicDatabase(input);
    try {
      // Normalize timestamps and classification attributes for deterministic fixtures.
      database.run("UPDATE document_info SET created_at = ?, updated_at = ?", [timestamp, timestamp]);
      database.run("UPDATE data_history_state SET saved_at = ?", [timestamp]);
      for (const [table, prefix] of [["industries", "1"], ["departments", "2"]]) {
        for (const [id] of database.exec(`SELECT id FROM ${table}`)[0]?.values ?? []) {
          database.run(`UPDATE ${table} SET identity = ? WHERE id = ?`, [prefix + Number(id).toString(16).padStart(31, "0"), Number(id)]);
        }
      }
      return database.export();
    } finally { database.close(); }
  };
  bytes = await stable(bytes);
  const initiative = (await readPlanContents(bytes)).initiatives[0]!;
  const draft: InitiativeEntryDraft = { ...initiative, fiscalYear: String(fiscalYear) };
  const historic = (amount: string) => ({ ...draft, note: "履歴確認用の過去の状態", rows: draft.rows.map((row, index) => index === 0 ? { ...row, amounts: { ...row.amounts, 4: amount } } : row) });
  const initial = await stable(await updateInitiative(bytes, initiative.id, fiscalYear, historic("100")));
  bytes = await trackHistoryChange(initial, await stable(await updateInitiative(initial, initiative.id, fiscalYear, historic("110"))), timestamp);
  bytes = await recordDataHistory(bytes, timestamp.replace("00:00:00", "00:05:00"));
  bytes = await trackHistoryChange(bytes, await stable(await updateInitiative(bytes, initiative.id, fiscalYear, draft)), timestamp.replace("00:00:00", "00:06:00"));
  return recordDataHistory(bytes, timestamp.replace("00:00:00", "00:11:00"));
}

/** Accepted boundary data: row and period sums cancel before range validation. */
export async function createCostCancellationPlan(fiscalYear = 2026) {
  let bytes = await createTriadicDatabase(fiscalYear);
  const plan = await readPlanContents(bytes);
  const accountId = plan.accounts.find(account => account.accountType === "sales")!.id;
  const maximum = "9007199254740.991";
  for (const [index, sign] of [1, 1, -1].entries()) bytes = await registerInitiative(bytes, {
    name: `相殺後の上限確認${index + 1}`, note: "別施策の順を変えても総原価表・施策一覧・展開表の金額は同じです。4月・5月・6月の年間計も相殺後の上限内です。",
    fiscalYear: String(fiscalYear), expansionId: 1, industryId: 1, departmentId: 1,
    rows: [{ accountId, amounts: { 4: sign === 1 ? maximum : `-${maximum}`,
      5: sign === 1 ? `-${maximum}` : maximum, 6: sign === 1 ? maximum : `-${maximum}` } }],
  });
  return bytes;
}
