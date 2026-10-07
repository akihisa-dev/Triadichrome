import { trackHistoryChange, recordDataHistory } from "../../Triadichrome-extension/src/core/storage/dataHistory";
import { savePreviousAmounts } from "../../Triadichrome-extension/src/core/storage/settings";
import { INITIAL_KINDS } from "../../Triadichrome-extension/src/core/domain/kinds";
import { INITIAL_PERIOD_TYPES } from "../../Triadichrome-extension/src/core/storage/periodMasterSchema";
import { INITIAL_DEPARTMENTS } from "../../Triadichrome-extension/src/core/storage/departmentSchema";
import { INITIAL_INDUSTRIES } from "../../Triadichrome-extension/src/core/storage/industrySchema";
import { INITIAL_EXPANSIONS } from "../../Triadichrome-extension/src/core/storage/expansionSchema";
import { changeAccountMaster } from "../../Triadichrome-extension/src/core/storage/accountMaster";
import { changeAggregationMaster } from "../../Triadichrome-extension/src/core/storage/aggregationMaster";
import { createTriadicDatabase, openTriadicDatabase } from "../../Triadichrome-extension/src/core/storage/triadicDatabase";
import { currentFiscalYear, initiativeMonths } from "../../Triadichrome-extension/src/core/domain/calendar";
import { readPlanContents } from "../../Triadichrome-extension/src/core/storage/readPlan";
import { registerInitiative, updateInitiative } from "../../Triadichrome-extension/src/core/storage/initiatives";
import { type InitiativeEntryDraft, type InitiativeRow } from "../../Triadichrome-extension/src/core/domain/plan";

// All amount literals are in thousands of yen; 0.001 represents one yen.
// Previous amounts span every industry/department pair; varying sales verify full, partial and multi-chip totals.
// Shared by the preview and the generated .triadic sample, using the app's own validation.
export async function createSamplePlan(fiscalYear = currentFiscalYear()): Promise<Uint8Array> {
  let bytes = await createTriadicDatabase(fiscalYear);
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
  const add = async (name: string, note: string, rows: InitiativeRow[], periodTypeId?: number) => {
    const codes: Record<string, string> = {
      "既存商品の販売拡大": "5", "保守サービスの新規契約": "5", "季節キャンペーン": "5",
      "通信運搬費と消耗品費の削減": "1", "サブスクリプション事業の拡大": "2",
      "設備更新と償却費の見直し": "1", "助成金の受入れ": "9",
      "ゼロと相殺の確認": "8", "未確定施策の入力準備": "8",
    };
    const expansionId = expansions.find(item => item.expansionCode === (codes[name] ?? "5"))!.id;
    bytes = await registerInitiative(bytes, { name, note, expansionId, industryId: industries[(await readPlanContents(bytes)).initiatives.filter(item => item.industryId != null).length % industries.length]!.id, periodTypeId: periodTypeId ?? periodTypes[(await readPlanContents(bytes)).initiatives.length % periodTypes.length]!.id, departmentId: departments[(await readPlanContents(bytes)).initiatives.length % departments.length]!.id, fiscalYear: String(fiscalYear), rows: rows.map((row,index) => ({ ...row, id: `sample:${name}:${index}` })) });
  };

  await add("既存商品の販売拡大", "ホームの「画面とデータ」で施策一覧を選び、施策名・開始年月・科目行・月別増減・確定予算の手修正の保存先を確認できます。全12か月の増減計画。同じ売上高の2行は直販と代理店販売です。新規登録は施策一覧の「施策を追加」から進みます。入力後に一覧へ戻ると破棄確認が出ます。キャンセルで入力を保持し、破棄後の追加は空欄、登録成功後は一覧へ戻ることを確認できます。一次予算4月の120を130へ変更し、保存後に「操作を取り消す」で120、「操作をやり直す」で130になることを確認できます。確定予算4月の手修正130と11月の手修正0は維持します。", [
    { ...annual("売上高", 120, 5), overrides: { 2: { 4: "130", 10: "170", 11: "0" } } }, annual("売上高", 30, 1), annual("本支店売上原価", 60, 2.5),
    annual("宣伝広告費", 8), annual("旅費", 3), annual("営業外収益", 0.125),
  ]);
  await add("保守サービスの新規契約", "一次予算は7月開始、確定予算は7月を全科目で0に手修正して8月開始。開始年月が種別ごとに変わることを施策一覧と明細で確認できます。", [
    { ...row("グループ売上高", { 7: "80", 8: "80", 9: "100", 10: "100", 11: "120", 12: "120", 1: "140", 2: "140", 3: "160" }), overrides: { 2: { 7: "0" } } },
    { ...row("店内売上原価", { 7: "30", 8: "30", 9: "40", 10: "40", 11: "50", 12: "50", 1: "60", 2: "60", 3: "70" }), overrides: { 2: { 7: "0" } } },
    { ...row("給料手当", { 7: "20", 8: "20", 9: "20", 10: "20", 11: "20", 12: "20", 1: "20", 2: "20", 3: "20" }), overrides: { 2: { 7: "0" } } },
  ]);
  await add("季節キャンペーン", "夏季と年末の単月施策。一覧の施策名を選ぶと全画面の施策入力へ直接移動します。備考と月額を編集して自動保存し、一覧へ戻って開き直すと更新内容が保持されていることを確認できます。未入力月と入力済みのゼロを比較できます。", [
    row("売上高", { 6: "50", 7: "75", 12: "180", 1: "0" }),
    row("本支店売上原価", { 6: "20", 7: "30", 12: "72", 1: "0" }),
    row("宣伝広告費", { 5: "15", 6: "25", 11: "40" }),
  ]);
  await add("通信運搬費と消耗品費の削減", "費用の負数は削減額です。施策一覧の4月は売上0・費用-4・利益4と表示されます。明細の売上・費用・利益は、通信運搬費で0・-3・3と表示されます。入力の小数と整数千円の表示を比較できます。3月は1円の端数を保持します。", [
    annual("通信運搬費", -2.5), row("消耗品費", { ...annual("消耗品費", -1.25).amounts, 3: "-1.251" }),
  ]);
  await add("サブスクリプション事業の拡大", "毎月の増加と先行費用を含む計画です。前年入力・総原価表では業種と部署のチップを複数選び、組み合わせの合計を参照できます。一つずつに絞ると入力へ戻ります。", [
    annual("本支店売上高", 40, 10), annual("店内売上原価", 15, 2),
    annual("給料手当", 30), annual("賃借料", 10),
  ]);
  await add("設備更新と償却費の見直し", "10月から新しい設備の償却を開始し、旧設備分を減額します。", [
    row("固定資産減価償却費", { 10: "18", 11: "18", 12: "18", 1: "18", 2: "18", 3: "18" }),
    row("固定資産減価償却費", { 10: "-5", 11: "-5", 12: "-5", 1: "-5", 2: "-5", 3: "-5" }),
    row("消耗品費", { 9: "25" }),
  ]);
  await add("助成金の受入れ", "利益属性の科目。9月と翌3月だけ計上します。業種・部署の分類と利益への加算を確認できます。", [row("営業外収益", { 9: "100", 3: "50" })]);
  await add("ゼロと相殺の確認", "4月は明示的なゼロ、5月は同じ科目の正負が相殺、6月以降の空欄は0として保存されます。総原価表・展開表では表示上0の金額・差額は空白です。展開表のこの施策は全月空白ですが、施策入力では0を確認できます。", [
    row("売上高", { 4: "0", 5: "12.5" }), row("売上高", { 5: "-12.5" }),
  ]);
  await add("未確定施策の入力準備", "全月0でも科目は使用中です。未所属費用を集計へ移す操作も試せます。", [row("未所属費用", {})]);

  await add("確定予算の手修正", "確定予算だけを月ごとに手修正します。総原価表で一次予算のみ・確定予算のみ・両方を選び、前年差と一次予算差を確認できます。売上高4月は前年25,290、一次予算25,640、確定予算25,670。一次予算のみの前年差は350、確定予算のみと両方の前年差は380、両方の一次予算差は30です。5月の一次予算差は-100です。", [{ ...annual("売上高", 100), overrides: { 2: { 4: "120", 5: "0" } } }]);
  await add("確定予算の下期調整", "確定予算10月を150に手修正しています。一次予算との差を確認できます。", [{ ...annual("売上高", 100), overrides: { 2: { 10: "150" } } }]);
  await add("確定予算のゼロ固定", "確定予算10月は0、4月は90。手修正0の固定と引き継ぎへの復帰を確認できます。", [{ ...annual("グループ売上高", 100), overrides: { 2: { 10: "0", 4: "90" } } }]);
  await add("科目変更と削除の確認", "全種別・全月0の行は科目の変更と行の削除ができます。2行の4〜6月を範囲選択し、複数行・複数月の貼り付け、同値入力、0への消去を確認できます。", [row("未所属費用", {}), row("売上高", {})]);
  await add("期間差の開始年月確認", "一次予算は4〜9月の増減から前年10月開始、確定予算は10月にも増減があるため前年11月開始です。6月の0も継続とみなし、正負の相殺で合計0でも開始年月を判定します。", [10, -10].map(amount => ({
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
  const timestamp = `${String(fiscalYear).padStart(4, "0")}-04-01T00:00:00.000Z`;
  const stable = async (input: Uint8Array) => {
    const database = await openTriadicDatabase(input);
    try {
      // Normalize both current and embedded snapshot metadata for deterministic fixtures.
      database.run("UPDATE plan SET created_at = ?, updated_at = ?", [timestamp, timestamp]);
      database.run("UPDATE data_history_state SET saved_at = ?", [timestamp]);
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
