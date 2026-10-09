// Excel出力では選択した表と条件を保ち、従来の三表と計算元、および基本関数による金額の再計算を確認する。
import { editDatabase } from "../../Triadichrome-extension/src/core/storage/transaction";
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
export const LARGE_SAMPLE_INITIATIVES = 1000;

export async function createSamplePlan(fiscalYear = currentFiscalYear(), large = false): Promise<Uint8Array> {
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
    bytes = await registerInitiative(bytes, { name, note, expansionId, industryId: industries[(await readPlanContents(bytes)).initiatives.filter(item => item.industryId != null).length % industries.length]!.id, periodTypeId: name === "未確定施策の入力準備" ? null : periodTypeId ?? periodTypes.find(item => item.periodName === "新規")!.id, departmentId: departments[(await readPlanContents(bytes)).initiatives.length % departments.length]!.id, fiscalYear: String(fiscalYear), rows: rows.map((row,index) => ({ ...row, id: `sample:${name}:${index}` })) });
  };

  await add("既存商品の販売拡大", "「入出力」で三表を選び、一次・確定の比較と期間計をExcelへ出力できます。Excelは三表と計算元の構成です。Excelの施策一覧も最下部に月別売上・費用・利益の合計行を出力し、全施策の元金額の編集と行のコピー追加に追従します。施策0件は0です。「計算元」の月別金額を変更するとSUMIFSによる科目・施策の集計と期間計へ反映します。大きい元金額は文字列で保持し、非表示の整数分割列で円精度を維持します。コピー追加は非表示列を含む行全体をコピーします。境界検証では大きい正負を相殺した499円・500円の表示と期間計・比較差を確認します。展開表の期間マスタ順・同期間の縦結合・同期間内の登録順と3固定列、施策一覧の4固定列を確認できます。展開表を縦横にスクロールし、3段見出しと前年・合計・展開計の行が上端に固定され、施策行と展開別小計だけが縦に移動することを確認できます。未確定施策の入力準備は期間未選択で、展開内の最後に空欄で表示されます。前年入力フォーマットはファイル選択と前年入力領域への単一.xlsxファイルのドロップで取り込めます。ドラッグ中の強調、複数ファイル・Excel以外の拒否、変更確認中の再取り込み防止を確認できます。結合セルや展開量の上限を超えるExcelは計画を変えずに拒否し、通常の取り込みへ戻れることを専用の自動生成データで確認します。列数・セル位置の属性名が似た名前や引用符内の文字に置き換わらないことも、小さい合成Excelを使う自動テストで確認します。必要な業種・部署だけを選び、金額の修正・空欄の保持・0への更新・変更確認・取り消しを試せます。画面テストの「前年フォーマットの上限確認（330科目・18組）」では、全18組の出力を止める案内と、組み合わせを減らした出力・再取り込みを確認できます。新規計画で未使用の部署・業種を対象に出力し、削除後に同じ名称で作り直すと古いExcelの取り込みを拒否すること、改名だけなら取り込めることを確認できます。ホームの「計算の仕組み」で予算の引き継ぎ・科目から売上と利益・開始年月を、「処理の流れ」で自動保存・失敗・履歴を確認できます。仕組みの閲覧は実際の値を出さず、計画を変更しません。「画面とデータ」で施策一覧を選び、展開名・期間名・施策名・開始年月・科目行・月別増減・確定予算の手修正の保存先を確認できます。施策一覧の最下部で表示領域の下端に追従する合計行で全施策の月別売上・費用・利益を確認し、縦横スクロールと並べ替えで合計が固定されること、一次・確定の切り替えで合計が変わることを確認できます。施策一覧の4固定列の見出しを押すと昇順▲・降順▼で並べ替えます。同値の登録順、空欄が最後、種別ごとの開始年月、画面を離れた後の登録順への復帰を確認できます。施策一覧の固定列は展開名「拡販」・期間名「新規」・施策名・開始年月の順で、横スクロール後も確認できます。期間差の確認施策は期間名「期間差」、費用削減施策は展開名「コスト」と表示されます。全12か月の増減計画。同じ売上高の2行は直販と代理店販売です。施策入力の表の最下部には売上・売上原価・費用・利益の合計行を表示します。一次予算4月の売上合計は150、売上原価合計は60、費用合計は11、利益属性の合計は0（元の値0.125）です。確定予算4月の売上合計は160です。金額編集と一次予算の反映で合計が追従します。新規登録は施策一覧の「施策を追加」から進みます。入力後に一覧へ戻ると破棄確認が出ます。キャンセルで入力を保持し、破棄後の追加は空欄、登録成功後は一覧へ戻ることを確認できます。一次予算4月の120へ「-」「1e」を実際のキー操作で入力し、種別切替後に別セルを編集・貼付・消去しても保存されないことを確認できます。元セルへ戻ると不正状態が残り、Escで120へ戻すか有効な値へ訂正すると保存できます。通常の空欄は0で、確定予算の手修正0と引き継ぎも維持します。一次予算4月の120を130へ変更し、保存後に「操作を取り消す」で120、「操作をやり直す」で130になることを確認できます。確定予算4月の手修正130と11月の手修正0は維持します。", [
    { ...annual("売上高", 120, 5), overrides: { 2: { 4: "130", 10: "170", 11: "0" } } }, annual("売上高", 30, 1), annual("本支店売上原価", 60, 2.5),
    annual("宣伝広告費", 8), annual("旅費", 3), annual("営業外収益", 0.125),
  ]);
  await add("保守サービスの新規契約", "一次予算は7月開始、確定予算は7月を全科目で0に手修正して8月開始。開始年月が種別ごとに変わることを施策一覧で確認できます。", [
    { ...row("グループ売上高", { 7: "80", 8: "80", 9: "100", 10: "100", 11: "120", 12: "120", 1: "140", 2: "140", 3: "160" }), overrides: { 2: { 7: "0" } } },
    { ...row("店内売上原価", { 7: "30", 8: "30", 9: "40", 10: "40", 11: "50", 12: "50", 1: "60", 2: "60", 3: "70" }), overrides: { 2: { 7: "0" } } },
    { ...row("給料手当", { 7: "20", 8: "20", 9: "20", 10: "20", 11: "20", 12: "20", 1: "20", 2: "20", 3: "20" }), overrides: { 2: { 7: "0" } } },
  ]);
  await add("季節キャンペーン", "夏季と年末の単月施策。一覧の施策名を選ぶと全画面の施策入力へ直接移動します。備考と月額を編集して自動保存し、一覧へ戻って開き直すと更新内容が保持されていることを確認できます。未入力月と入力済みのゼロを比較できます。", [
    row("売上高", { 6: "50", 7: "75", 12: "180", 1: "0" }),
    row("本支店売上原価", { 6: "20", 7: "30", 12: "72", 1: "0" }),
    row("宣伝広告費", { 5: "15", 6: "25", 11: "40" }),
  ]);
  await add("通信運搬費と消耗品費の削減", "費用の負数は削減額です。施策一覧の4月は売上0・費用-4・利益4と表示されます。施策詳細で通信運搬費4月の入力額-3を確認できます。入力の小数と整数千円の表示を比較できます。3月は1円の端数（施策一覧・総原価表・展開表の合計と差額でも保持）を保持します。", [
    annual("通信運搬費", -2.5), row("消耗品費", { ...annual("消耗品費", -1.25).amounts, 3: "-1.251" }),
  ]);
  await add("サブスクリプション事業の拡大", "毎月の増加と先行費用を含む計画です。前年入力・総原価表では業種と部署のチップを複数選び、組み合わせの合計を参照できます。一つずつに絞ると入力へ戻ります。計算上限を超えた分類合計は空欄と通知になり、分類を絞って金額を修正できます（専用のoverflow-previous-input確認データで試します）。", [
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
  await add("未確定施策の入力準備", "全月0のため開始年月は空欄です。全月0でも科目は使用中です。勘定科目マスタで区分が科目・集計の一つの一覧になり、集計・加減列で未所属費用を所属させる操作を試せます。科目・集計の並べ替え後は総原価表と前年入力が同じ行順になります。削除確認用科目の表示名は表示名確認用です。名称と表示名が同じ行の改名は表示名にも追従し、別の表示名の行は保持します。集計行にはコード・属性や内訳欄がありません。", [row("未所属費用", {})]);

  await add("確定予算の手修正", "確定予算だけを月ごとに手修正します。総原価表で一次予算のみ・確定予算のみ・両方を選び、前年差と一次予算差を確認できます。売上高4月は前年25,290、一次予算25,640、確定予算25,670。一次予算のみの前年差は350、確定予算のみと両方の前年差は380、両方の一次予算差は30です。5月の一次予算差は-100です。", [{ ...annual("売上高", 100), overrides: { 2: { 4: "120", 5: "0" } } }]);
  await add("確定予算の下期調整", "確定予算10月を150に手修正しています。一次予算との差を確認できます。この施策の一次予算は各四半期300・上期600・下期600・年間1,200、確定予算は第3四半期350・下期650・年間1,250です。両表の期間計と比較差50を確認できます。", [{ ...annual("売上高", 100), overrides: { 2: { 10: "150" } } }]);
  await add("確定予算のゼロ固定", "確定予算10月は0、4月は90。手修正0の固定と、確定予算タブの表の上に一つだけある「一次予算を反映する」で全科目・全月を一次予算へ戻す操作を確認できます。セル内は数値のみで、単位・精度の注記は各画面に常設しません。反映後の4月・10月は100となり、その後の一次予算の変更へ追従します。登録済み施策は自動保存され、操作の取り消し・やり直しで復元できます。", [{ ...annual("グループ売上高", 100), overrides: { 2: { 10: "0", 4: "90" } } }]);
  await add("科目変更と削除の確認", "全種別・全月0のため開始年月は空欄です。表の最下部は売上合計・費用合計の2行だけを表示し、存在しない売上原価・利益の合計行は表示しません。全種別・全月0の行は科目の変更と行の削除ができます。4月を100へ変更して保存した後に0へ戻すと、0の保存成功まで科目変更と削除は無効になります。非0への保存開始後・確定前に0へ戻した場合も、実行中の保存と最新の0化の保存が終わるまで科目変更・削除を待ちます。その間も別月や備考への追加入力は続けられます。保存後は操作でき、保存失敗時は最新の入力を保持して再試行・取消ができます。売上高4月へ0.0001を入力すると、合計エラーと保存失敗は重ならず表示され、「入力を取り消す」で保存済み金額に戻ります。全12月をF2で文字編集して空欄にし、科目を未選択に戻すと保存後に旧科目行が残らないことを確認できます。2行の4〜6月を範囲選択し、複数行・複数月の貼り付け、同値入力、0への消去を確認できます。", [row("未所属費用", {}), row("売上高", {})]);
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
  if (large) {
    // Copy validated rows within the production transaction. Opposite signs preserve
    // the original fixture's totals, including confirmed overrides and one-yen values.
    bytes = (await editDatabase(bytes, database => {
      const sourceId = Number(database.exec("SELECT id FROM initiatives ORDER BY sort_order LIMIT 1")[0]!.values[0]![0]);
      const firstOrder = Number(database.exec("SELECT MAX(sort_order) + 1 FROM initiatives")[0]!.values[0]![0]);
      for (let index = 0; index < LARGE_SAMPLE_INITIATIVES; index++) {
        const name = `大規模確認施策${String(index + 1).padStart(4, "0")}`;
        database.run(`INSERT INTO initiatives (name, note, expansion_id, industry_id, department_id, period_type_id, sort_order)
          SELECT ?, ?, ?, ?, ?, period_type_id, ? FROM initiatives WHERE id = ?`,
          [name, "12科目行・12か月・2種別。正負の対で相殺し、既存の確認用合計を維持します。",
            expansions[index % expansions.length]!.id, industries[index % industries.length]!.id,
            departments[index % departments.length]!.id, firstOrder + index, sourceId]);
        const id = Number(database.exec("SELECT last_insert_rowid()")[0]!.values[0]![0]);
        for (const sign of [1, -1]) {
          const prefix = `large:${index}:${sign}:`;
          database.run(`INSERT INTO initiative_rows (id, initiative_id, account_id, sort_order)
            SELECT ? || id, ?, account_id, sort_order * 2 + ? FROM initiative_rows WHERE initiative_id = ?`,
            [prefix, id, sign === 1 ? 0 : 1, sourceId]);
          database.run(`INSERT INTO initiative_amounts (row_id, month, amount_yen)
            SELECT ? || m.row_id, m.month, m.amount_yen * ? FROM initiative_amounts m
            JOIN initiative_rows r ON r.id = m.row_id WHERE r.initiative_id = ?`, [prefix, sign, sourceId]);
          database.run(`INSERT INTO amount_overrides (row_id, month, amount_yen)
            SELECT ? || o.row_id, o.month, o.amount_yen * ? FROM amount_overrides o
            JOIN initiative_rows r ON r.id = o.row_id WHERE r.initiative_id = ?`, [prefix, sign, sourceId]);
        }
      }
    })).bytes;
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
