import { dataMapSchema } from "../core/storage/dataMapSchema.generated";
import { describeDataTables, type DataColumn, type DataTable } from "../core/storage/dataMapDescription";
import type { Page } from "./HomePage";
export type { DataColumn, DataTable };
type TableName = typeof dataMapSchema[number]["name"];
type ColumnName<T extends TableName> = Extract<typeof dataMapSchema[number], { name: T }>["columns"][number]["name"];
const tableLabels: Partial<Record<TableName, string>> = {
  document_info: "基本情報", initiatives: "施策", initiative_rows: "施策の科目行", initiative_amounts: "施策の種別別金額", previous_amounts: "前年の実額", accounts: "勘定科目", aggregation_groups: "集計",
  aggregation_members: "集計の所属・加減算", expansions: "展開", industries: "業種", departments: "部署", department_industries: "部署の所属業種", period_types: "期間",
  kind_selections: "画面ごとの種別選択", data_history: "時点履歴", data_history_state: "履歴の記録状態", master_order: "科目・集計の表示順", triadic_metadata: "保存形式の識別情報",
};
// Labels explain meaning; table names, columns and references come from the saved schema.
const columnLabels: Record<string, string> = {
  id: "識別子", name: "名称", code: "コード", identity: "作成識別子", revision: "更新番号", sort_order: "並び順", kind_id: "予算種別", month: "月", amount_yen: "金額（円）",
  fiscal_year: "基準年度", created_at: "作成日時", updated_at: "更新日時", note: "備考", expansion_id: "展開", industry_id: "業種",
  department_id: "部署", period_type_id: "期間",
  initiative_id: "施策", account_id: "勘定科目", row_id: "施策の科目行", attribute: "科目属性", display_name: "表示名", required_key: "必須集計の役割",
  aggregation_group_id: "集計", parent_id: "所属先の集計", group_id: "子集計", sign: "加算・減算", position: "所属内の並び順", start_month_rule: "開始年月の算出規則",
  screen: "画面", first_kind: "比較対象1・表示種別", second_kind: "比較対象2", recorded_at: "記録日時", snapshot: "計画全体の保存内容",
  version: "履歴管理の版", next_id: "次の履歴識別子", dirty_since: "未記録の変更の開始日時", saved_at: "最新の保存日時", key: "情報名", value: "値",
  "master_order.position": "表示位置", "initiatives.name": "施策名", "initiative_rows.id": "科目行の識別子", "accounts.name": "科目名", "accounts.code": "科目コード",
  "aggregation_groups.name": "集計名", "expansions.code": "展開コード", "expansions.name": "展開名", "industries.code": "業種コード",
  "industries.name": "業種名", "departments.name": "部署名", "period_types.name": "期間名",
};
export const dataTables = describeDataTables(dataMapSchema, tableLabels, columnLabels);
export type TableUse = { table: TableName; purpose: string; fields: string[] };
export type ScreenData = { page: Exclude<Page, "home" | "master">; name: string; tables: TableUse[]; calculated: string[] };
const use = <T extends TableName>(table: T, purpose: string, ...fields: ColumnName<T>[]): TableUse => ({ table, purpose, fields });
const documentInfo = use("document_info", "共通ヘッダーの基準年度・対象月", "fiscal_year");
const initiative = use("initiatives", "施策名・備考・分類", "name", "note", "expansion_id", "industry_id", "department_id", "period_type_id", "sort_order");
const rows = use("initiative_rows", "施策と科目の対応・科目行の並び", "id", "initiative_id", "account_id", "sort_order");
const amounts = use("initiative_amounts", "一次12か月と確定の明示手修正月の増減", "row_id", "kind_id", "month", "amount_yen");
const accounts = use("accounts", "科目名・表示名・科目属性", "id", "code", "name", "display_name", "attribute");
const previous = use("previous_amounts", "科目・業種・部署ごとの前年実額", "account_id", "industry_id", "department_id", "month", "amount_yen");
const groups = use("aggregation_groups", "売上・費用・利益などの集計と表示名", "id", "name", "display_name", "required_key");
const members = use("aggregation_members", "科目・子集計の所属と加減算", "parent_id", "account_id", "group_id", "sign", "position");
const classifications = [use("expansions", "展開名", "id", "name"), use("industries", "業種名と作成識別子", "id", "name", "identity"),
  use("departments", "部署名と作成識別子", "id", "name", "identity"), use("period_types", "期間名と開始年月の規則", "id", "name", "start_month_rule")];
const departmentIndustries = use("department_industries", "部署に設定した複数の業種", "department_id", "industry_id");
const departmentIndustryRule = "部署の所属業種をdepartment_industriesに保存します。施策の業種候補を選択部署の所属へ絞り、一つなら自動選択します。所属変更の保存成功後は保持中の新規施策にも単一業種を反映し、他の入力を保持します。保存失敗では保持中の施策を変更しません。前年入力とExcelの出力・取り込みも所属する組み合わせだけを使います。施策・前年入力で使用中の所属は解除できず、部署に設定中の業種は削除できません。所属の変更で金額を移動・合算しません。";
const presentation = use("master_order", "科目・集計共通の唯一の表示順", "position", "account_id", "aggregation_group_id");
const masterDisplay = "科目属性に売上・売上原価・費用・利益・集計を表示し、区分列を設けず同じ一覧で管理します。新規登録は科目属性で種類を選び、集計はコードなしで登録します。集計列は所属先、加減列はその所属への符号を＋／−のボタンで設定します。選択背景は0.4秒で滑り、左右キーにも対応します。クリック直後に仮の選択を表示し、保存中は追加変更を止めます。未所属は無効、保存失敗時は保存済みの符号へ戻します。符号だけの変更では所属内の順序を保ち、共通順が同じなら書き直しません。集計の変更と履歴・表示の準備は作業用データベースを共有し、変更前後と取消用データの全体検証を維持します。背景の位置・幅は画面内だけの情報です。科目・集計を参照するmaster_orderの位置を唯一の順序として保存し、種類別の順序はその部分列から求めます。共通の保存順と表示名を総原価表・前年入力・総原価表のExcel出力へ反映します。名称と表示名が同じ間は一緒に更新し、別の表示名は保持します。科目の独自表示名はaccounts.display_nameに保持し、正式名と同じ場合はNULLで省略します。";
const selection = use("kind_selections", "この画面の種別選択を復元", "screen", "first_kind", "second_kind");
const selectionSave = "種別選択の変更では、取消用の前後データと時点履歴を一つの作業用データベースで準備し、金額・施策・マスタの読み直しを省きます。保存成功後に選択を反映し、失敗時は保存済みの選択と表示を維持します。";
const resolved = "initiative_amountsの種別1を一次予算、種別2のレコードを確定予算の明示手修正として使います。種別2がない月だけ一次を引き継ぎ、明示0と同額の手修正も固定します。";
const reflectPrimary = "確定予算タブの一次予算を反映する操作は、表示中の施策の全科目・全月の手修正を解除して一次予算への追従へ戻します。登録前は入力に反映し、登録済みは自動保存します。";
const amountTotals = "金額表の最下部に、金額項目マスタの順番と構成に従い売上・費用・利益の月別合計3行を常に表示します。選択種別の有効金額を構成の符号で円の整数として加減算し、表示時だけ丸めます。科目未選択・属性未設定は計算対象外で、入力行がなくても0を表示します。合計は入力に追従し、保存しません。不正入力や計算範囲超過では該当合計を空白にします。";
const invalidAmountInput = "数値として扱えない施策の入力は、種別・科目行・月ごとに不正状態と入力開始時の値を画面内で保持します。種別を切り替えて別セルを編集しても保存せず、元セルの訂正・消去・取消でそのセルだけ解除します。セルの取消後も引き継ぎと手修正0を維持します。この一時情報は計画ファイルへ保存しません。";
const rounded = "金額は保存と集計の途中も円の整数で保持し、画面では千円に換算して整数へ丸めます。編集欄では小数点以下3桁まで表示します。";
const blankZero = "丸めた表示が0になる金額・差額は空白にします。総原価表の利益率・利益率の差も同様です。保存値と計算には元の値を使います。";
const calculationFailure = "総原価表・展開表の計算範囲を超えた場合は表の部分に理由を表示し、画面移動・表示条件の変更を維持します。金額や条件の変更後に再計算し、表示失敗では保存値を書き換えません。";
const largeDisplay = "行数が多い表は画面周辺の行だけを描画します。合計と並べ替えは全件を対象とし、スクロールで全行を確認できます。表示を省いた行も保存内容から削除しません。";
const initiativeTables = [documentInfo, initiative, rows, amounts, accounts, ...classifications];
export const screenData: ScreenData[] = [
  { page: "spreadsheet-io", name: "入出力", tables: [documentInfo, departmentIndustries, initiative, rows, amounts, accounts, previous, groups, members, presentation, ...classifications],
    calculated: [departmentIndustryRule, "出力する表・種別・比較対象・総原価表の分類は入出力画面内で選び、通常画面の表示設定と計画には保存しません。選択した三表と従来の計算元を出力します。Excelの施策一覧も最下部に月別売上・費用・利益の合計行を出力し、全施策の元金額の編集と行のコピー追加に追従します。施策0件は0です。金額はExcelでも円精度を保つため、大きい元金額を文字列として保持し、非表示列で上位の千円整数・下位6桁の千円整数・1円部分へ分けます。各部分をSUMIFS・SUMIF・SUMで合算し、期間計・比較差・利益率は丸める前の部分を参照します。表示セルだけ整数千円へ丸めます。計算元の文字列金額は千円単位・小数点以下3桁までの文字列として編集し、行を追加する場合は非表示列を含む行全体をコピーしてください。計算元には全計画の前年実額と一次・確定の解決済み金額を入れ、SUMIFSによる科目・施策・種別・分類の条件集計とSUMIF・SUMの期間計を使います。離れた小計の合計は各SUMを255引数以内に分け、対象の小計だけを合算します。金額の編集と既存元データ行のコピー追加を計算へ反映します。表示行・名称・所属は出力時点の内容を維持します。", "前年入力フォーマットは選んだ業種・部署の組み合わせごとに別シートです。生成前の件数と生成後の実際の処理量を取り込みと共通の上限で確認し、上限内だけを提供します。超える場合は組み合わせを減らして別ファイルに分ける案内を表示します。Excelの有効15桁または数値変換で1円精度を保てない金額は文字列セルとして出力し、文字列のまま編集します。ファイル選択または前年入力領域への単一の.xlsxファイルのドロップで取り込みます。空欄は更新せず、0を含む入力金額を検証し、変更内容を確認後、一回の保存で previous_amounts へ反映します。作成識別子を読込時と保存時に照合し、同じ番号・名称でも作り直した分類への取り込みは拒否します。改名は許可します。識別子のない旧Excelは再出力が必要です。不正値・競合・保存失敗では部分更新しません。", rounded] },
  { page: "initiative-list", name: "施策一覧", tables: [documentInfo, use("initiatives", "施策名・備考の吹き出し・展開と期間への所属・並び順", "id", "name", "note", "expansion_id", "period_type_id", "sort_order"), rows, amounts, accounts, classifications[0]!, classifications[3]!, use("kind_selections", "施策一覧の表示種別", "screen", "first_kind")],
    calculated: [selectionSave, "開始年月は期間の算出規則と種別ごとの月額から読み込み時に導出し、保存しません。正負の相殺前の科目行で非0の月を判定し、確定の手修正0も反映します。", "金額・科目・年度が同じ間は種別ごとの月別金額・計算エラー・全件合計を画面内で再利用します。元の金額・科目・年度や履歴の状態が変わると作り直します。", resolved, "展開名・期間名・施策名・表示種別の開始年月で昇順・降順に並べ替えます。空欄は最後、同値は登録順です。表示順だけを変え、保存せず、画面を離れると登録順へ戻します。", "月別の売上・費用・利益は科目行の有効金額と科目属性から求めます。表の最下部で表示領域の下端に追従する合計行は表示種別の全施策を1円単位で合算します。空の月は0、属性未設定を含む売上・利益は属性未設定、表全体の上限超過は合計部分で通知します。施策内の上限超過はその行の金額欄で通知し、正常な施策の金額と施策名からの修正を維持します。この場合は合計を表示しません。一覧用の計算は一覧表示時だけ行い、ホームや施策編集を妨げません。合計行は並べ替えず、集計結果の保存テーブルはありません。", largeDisplay, rounded] },
  { page: "initiative-entry", name: "施策入力", tables: [...initiativeTables, departmentIndustries, presentation],
    calculated: [departmentIndustryRule, "登録前の入力は画面内で保持し、登録時に施策・科目行・月別金額へ保存します。", invalidAmountInput, resolved, reflectPrimary, amountTotals, "開始年月は期間の算出規則と種別ごとの月別増減から読み込み時に導出し、保存しません。", rounded] },
  { page: "initiative-detail", name: "施策詳細", tables: [...initiativeTables, departmentIndustries, presentation],
    calculated: [departmentIndustryRule, invalidAmountInput, resolved, reflectPrimary, amountTotals, "登録済み行の科目変更と削除は入力中と保存済みの両方が全種別・全月0のときに許可します。自動保存の実行中は科目変更と行削除を待ちます。非0の保存中に0へ戻した場合も、最新の0化の保存成功まで待ち、金額入力は続けられます。全種別・全月0の既存行を、金額も手修正も空欄・科目未選択に戻すと保存時に削除します。入力値のある未選択行は拒否します。", "開始年月は期間の算出規則と種別ごとの月別増減から読み込み時に導出し、保存しません。", rounded] },
  { page: "previous-input", name: "前年入力", tables: [documentInfo, departmentIndustries, previous, accounts, groups, members, presentation, classifications[1]!, classifications[2]!],
    calculated: [departmentIndustryRule, masterDisplay, "前年入力では部署名・業種名の順にドロップダウンで選びます。全件の合計は参照専用です。選択した組み合わせを科目・月ごとに合算します。業種・部署を一つずつ選ぶと、その組み合わせの前年実額を更新します。分類の選択は保存しません。所属変更や操作の取消・やり直し後は存在と所属を再確認し、無効な選択を解除して編集を止めます。未保存入力は選択補正で破棄しません。直接入力のエラーは科目・月ごとに扱い、訂正・編集取消・保存失敗後の入力取消で解消した通知を解除します。他セルの不正入力や集計超過、保存失敗は引き続き通知します。分類合計が計算上限を超えたときは計算セルを空欄にして通知し、分類を絞って元の金額を確認・修正できます。", "小計・合計は aggregation_groups の表示名・並び順と aggregation_members の科目・子集計の所属・加減算から求めます。売上集計の役割は固定見出しの範囲を決め、利益率は経常利益集計÷売上集計×100で計算します。未設定の集計や売上が0の場合の利益率は空欄です。月別列の右に上期（4〜9月）・下期（10〜3月）・通期（12か月）を表示し、丸める前の円額を合算します。期間の利益率は期間の経常利益÷売上集計で再計算します。期間列は参照専用で範囲入力にも含めず、上限超過セルは空欄と通知にして月別入力を保持します。保存する前年実額は previous_amounts だけで、小計・合計・利益率・期間計は保存しません。", rounded] },
  { page: "cost-table", name: "総原価表", tables: [documentInfo, departmentIndustries, previous, use("initiatives", "施策ごとの科目行と業種・部署への所属", "id", "industry_id", "department_id"), rows, amounts, accounts, groups, members, presentation, classifications[1]!, classifications[2]!, selection],
    calculated: [selectionSave, "計算元と分類が同じ間は比較結果を画面内で再利用し、元の金額・集計・分類が変わると再計算します。計算結果は保存しません。", masterDisplay, resolved, "業種・部署マスタの全候補から複数選択し、選択した組み合わせの科目別の施策増減と前年実額を合算して予算を求めます。分類の未選択は全件で、表示選択は保存しません。科目別の増減・前年分類合計・集計行は途中も正確な整数で加減算し、正負を相殺した最終合計で範囲を確認します。入力行や所属の順序で結果は変わりません。集計行は所属と加減算から求め、総原価表専用の保存テーブルはありません。前年差は表示する予算−前年（両方なら確定予算−前年）、一次予算差は確定予算−一次予算です。利益率の差はポイントで表示し、差の値は保存しません。四半期・上期・下期・年間の計は相殺後の合計で範囲を確認し、丸める前の月額を合算し、利益率は期間の経常利益合計÷売上集計合計で再計算します。", rounded, blankZero, calculationFailure] },
  { page: "expansion-table", name: "展開表", tables: [documentInfo, use("initiatives", "施策名・展開と期間への所属・並び順", "id", "name", "expansion_id", "period_type_id", "sort_order"), rows, amounts, previous, accounts, classifications[0]!, use("period_types", "期間名と表示順", "id", "name"), selection],
    calculated: [selectionSave, "計算元が同じ間は比較対象の組み合わせと順序ごとに金額・小計・期間別の行構成を再利用します。施策・科目・前年額・展開・期間・年度が変わると作り直し、結果は保存しません。", resolved, "各展開内を期間マスタ順・未選択は最後にまとめ、同じ期間名を縦結合します。同じ期間内は登録順で、表示順は保存しません。施策の売上・利益の増減を展開ごとにまとめ、前年から予算への積み上げを表示します。展開別小計と全施策の月別合計は正確な整数で加減算し、相殺後の最終値で範囲を確認します。施策の順序で結果は変わりません。2種比較は確定予算−一次予算です。四半期・上期・下期・年間の計は相殺後の合計で範囲を確認し、丸める前の売上・利益を期間内で合算し、属性未設定も引き継ぎます。展開表専用の保存テーブルはありません。", largeDisplay, rounded, blankZero, calculationFailure] },
  { page: "account-master", name: "勘定科目マスタ", tables: [documentInfo, accounts, groups, members, presentation], calculated: [masterDisplay, "科目行だけが金額の入力対象です。集計行は科目属性を集計と表示し、科目コードを設定せず、内訳列や計算対象の編集欄は設けません。科目・集計の並べ替えは所属を変えず、一回の保存で共通順を確定します。件数は保存しません。"] },
  ...classifications.map((item, index) => ({ page: (["expansion-master", "industry-master", "department-master", "period-master"] as const)[index]!,
    name: ["展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ"][index]!,
    tables: [documentInfo, use(item.table, dataTables.find(table => table.name === item.table)!.label + "の登録情報", ...dataMapSchema.find(table => table.name === item.table)!.columns.map(column => column.name)), ...(index === 1 || index === 2 ? [departmentIndustries, ...(index === 2 ? [classifications[1]!] : [])] : [])], calculated: [...(index === 1 || index === 2 ? [departmentIndustryRule] : []), "一覧の件数は登録済みの分類から求め、保存しません。業種・部署の作成識別子は各行のidentity属性へ必須・一意に保存します。改名や所属変更では維持し、削除・再作成では新しい識別子に変わります。識別子の欠落や旧Excelのlegacy値は拒否します。"] })),
  { page: "amount-item-master", name: "金額項目マスタ", tables: [documentInfo], calculated: ["売上・費用・利益の3件と表示順、構成する科目属性の加減算はアプリの固定定義です。追加・改名・並べ替え・構成変更・削除は行いません。売上＝売上属性−売上原価属性、費用＝費用属性、利益＝売上属性−売上原価属性−費用属性＋利益属性。表示と実際の計算は同じ定義を使います。専用の保存テーブルはなく、閲覧でファイルや金額を書き換えません。"] },
  { page: "account-type-master", name: "科目属性マスタ", tables: [documentInfo], calculated: ["売上・売上原価・費用・利益はアプリの固定定義です。名称・件数・並び順は勘定科目マスタの選択候補と同じ定義を使い、追加・改名・削除は行いません。科目属性マスタの保存テーブルはありません。科目ごとの選択は accounts.attribute に保存します。集計は科目属性マスタに含めず、勘定科目マスタの集計行として管理します。閲覧や画面移動でファイルを書き換えません。"] },
  { page: "kind-master", name: "種別マスタ", tables: [documentInfo], calculated: ["前年・一次予算・確定予算はアプリの固定定義です。種別マスタの保存テーブルはありません。前年実額は previous_amounts、施策金額は initiative_amounts に種別IDで区別して保存します。一次予算は12か月、確定予算は手修正月だけを保存し、明示0と同額の明示手修正も保持します。"] },
  { page: "data-history", name: "履歴", tables: [documentInfo, use("data_history", "記録日時と計画全体の保存内容", "id", "recorded_at", "snapshot"),
    use("data_history_state", "記録の識別子と未記録の変更を管理", "next_id", "dirty_since", "saved_at", "version")],
    calculated: ["過去閲覧では snapshot 内の計画テーブルを読み込みます。画面の移動履歴と操作の取り消し・やり直しはメモリ内に保持し、これらのテーブルへ保存しません。"] },
];
