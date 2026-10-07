import { dataMapSchema } from "../core/storage/dataMapSchema.generated";
import { describeDataTables, type DataColumn, type DataTable } from "../core/storage/dataMapDescription";
import type { Page } from "./HomePage";
export type { DataColumn, DataTable };
type TableName = typeof dataMapSchema[number]["name"];
type ColumnName<T extends TableName> = Extract<typeof dataMapSchema[number], { name: T }>["columns"][number]["name"];
const tableLabels: Partial<Record<TableName, string>> = {
  plan: "計画", initiatives: "施策", initiative_rows: "施策の科目行", initiative_amounts: "一次予算の月別増減",
  amount_overrides: "確定予算の手修正", previous_amounts: "前年の実額", accounts: "勘定科目", aggregation_groups: "集計",
  aggregation_members: "集計の所属・加減算", expansions: "展開", industries: "業種", departments: "部署", period_types: "期間",
  kind_selections: "画面ごとの種別選択", data_history: "時点履歴", data_history_state: "履歴の記録状態", triadic_metadata: "ファイル形式",
};
// Labels explain meaning; table names, columns and references come from the saved schema.
const columnLabels: Record<string, string> = {
  id: "識別子", name: "名称", code: "コード", revision: "更新番号", sort_order: "並び順", month: "月", amount_yen: "金額（円）",
  fiscal_year: "基準年度", created_at: "作成日時", updated_at: "更新日時", note: "備考", expansion_id: "展開", industry_id: "業種",
  department_id: "部署", period_type_id: "期間", primary_start_year_month: "一次予算の開始年月", confirmed_start_year_month: "確定予算の開始年月",
  initiative_id: "施策", account_id: "勘定科目", row_id: "施策の科目行", attribute: "科目属性", display_name: "表示名", required_key: "必須集計の役割",
  parent_id: "所属先の集計", group_id: "子集計", sign: "加算・減算", position: "所属内の並び順", start_month_rule: "開始年月の算出規則",
  screen: "画面", first_kind: "比較対象1・表示種別", second_kind: "比較対象2", recorded_at: "記録日時", snapshot: "計画全体の保存内容",
  version: "履歴管理の版", next_id: "次の履歴識別子", dirty_since: "未記録の変更の開始日時", saved_at: "最新の保存日時", key: "情報名", value: "値",
  "initiatives.name": "施策名", "initiative_rows.id": "科目行の識別子", "accounts.name": "科目名", "accounts.code": "科目コード",
  "aggregation_groups.name": "集計名", "expansions.code": "展開コード", "expansions.name": "展開名", "industries.code": "業種コード",
  "industries.name": "業種名", "departments.name": "部署名", "period_types.name": "期間名",
};
export const dataTables = describeDataTables(dataMapSchema, tableLabels, columnLabels);
export type TableUse = { table: TableName; purpose: string; fields: string[] };
export type ScreenData = { page: Exclude<Page, "home" | "master">; name: string; tables: TableUse[]; calculated: string[] };
const use = <T extends TableName>(table: T, purpose: string, ...fields: ColumnName<T>[]): TableUse => ({ table, purpose, fields });
const plan = use("plan", "共通ヘッダーの基準年度・対象月", "fiscal_year");
const initiative = use("initiatives", "施策名・備考・分類・種別ごとの開始年月", "name", "note", "expansion_id", "industry_id", "department_id", "period_type_id", "primary_start_year_month", "confirmed_start_year_month", "sort_order");
const rows = use("initiative_rows", "施策と科目の対応・科目行の並び", "id", "initiative_id", "account_id", "sort_order");
const primary = use("initiative_amounts", "一次予算の月別増減", "row_id", "month", "amount_yen");
const overrides = use("amount_overrides", "確定予算で手修正した月の増減", "row_id", "month", "amount_yen");
const accounts = use("accounts", "科目名・科目属性・並び順", "id", "code", "name", "attribute", "sort_order");
const previous = use("previous_amounts", "科目・業種・部署ごとの前年実額", "account_id", "industry_id", "department_id", "month", "amount_yen");
const groups = use("aggregation_groups", "売上・費用・利益などの集計と表示名", "id", "name", "display_name", "required_key", "sort_order");
const members = use("aggregation_members", "科目・子集計の所属と加減算", "parent_id", "account_id", "group_id", "sign", "position");
const classifications = [use("expansions", "展開名", "id", "name"), use("industries", "業種名", "id", "name"),
  use("departments", "部署名", "id", "name"), use("period_types", "期間名と開始年月の規則", "id", "name", "start_month_rule")];
const selection = use("kind_selections", "この画面の種別選択を復元", "screen", "first_kind", "second_kind");
const resolved = "確定予算の増減は、手修正がある月だけ amount_overrides を使い、それ以外は initiative_amounts を引き継ぎます。手修正の0も有効です。";
const rounded = "金額は円の整数で保存し、画面では千円に換算して整数へ丸めます。編集欄では小数点以下3桁まで表示します。";
const blankZero = "丸めた表示が0になる金額・差額は空白にします。総原価表の利益率・利益率の差も同様です。保存値と計算には元の値を使います。";
const initiativeTables = [plan, initiative, rows, primary, overrides, accounts, ...classifications];
export const screenData: ScreenData[] = [
  { page: "spreadsheet-io", name: "入出力", tables: [plan, initiative, rows, primary, overrides, accounts, previous, groups, members, ...classifications],
    calculated: ["出力する表・種別・比較対象・総原価表の分類は入出力画面内で選び、通常画面の表示設定と計画には保存しません。Excelの集計・差・期間計・利益率には元の値を参照する数式を出力します。", "前年入力フォーマットは選んだ業種・部署の組み合わせごとに別シートです。空欄は更新せず、0を含む入力金額を検証し、変更内容を確認後、一回の保存で previous_amounts へ反映します。不正値・競合・保存失敗では部分更新しません。", rounded] },
  { page: "initiative-list", name: "施策一覧", tables: [plan, use("initiatives", "施策名・備考の吹き出し・種別ごとの開始年月・並び順", "id", "name", "note", "primary_start_year_month", "confirmed_start_year_month", "sort_order"), rows, primary, overrides, accounts, use("kind_selections", "施策一覧の表示種別", "screen", "first_kind")],
    calculated: [resolved, "月別の売上・費用・利益は科目行の有効金額と科目属性から求めます。集計結果の保存テーブルはありません。", rounded] },
  { page: "initiative-entry", name: "施策入力", tables: initiativeTables,
    calculated: ["登録前の入力は画面内で保持し、登録時に施策・科目行・月別金額へ保存します。", resolved, "開始年月は期間の算出規則と種別ごとの月別増減から求め、施策へ保存します。", rounded] },
  { page: "initiative-detail", name: "施策詳細", tables: initiativeTables,
    calculated: [resolved, "開始年月は期間の算出規則と種別ごとの月別増減から再算出し、施策へ保存します。", rounded] },
  { page: "previous-input", name: "前年入力", tables: [plan, previous, accounts, classifications[1]!, classifications[2]!],
    calculated: ["選択した業種・部署の組み合わせを科目・月ごとに合算します。未選択は全件、複数選択の合計は参照専用です。業種・部署を一つずつ選ぶと、その組み合わせの前年実額を更新します。分類の選択は保存しません。", rounded] },
  { page: "cost-table", name: "総原価表", tables: [plan, previous, use("initiatives", "施策ごとの科目行と業種・部署への所属", "id", "industry_id", "department_id"), rows, primary, overrides, accounts, groups, members, classifications[1]!, classifications[2]!, selection],
    calculated: [resolved, "業種・部署マスタの全候補から複数選択し、選択した組み合わせの科目別の施策増減と前年実額を合算して予算を求めます。分類の未選択は全件で、表示選択は保存しません。集計行は所属と加減算から求め、総原価表専用の保存テーブルはありません。前年差は表示する予算−前年（両方なら確定予算−前年）、一次予算差は確定予算−一次予算です。利益率の差はポイントで表示し、差の値は保存しません。四半期・上期・下期・年間の計は丸める前の月額を合算し、利益率は期間の経常利益合計÷売上集計合計で再計算します。", rounded, blankZero] },
  { page: "expansion-table", name: "展開表", tables: [plan, use("initiatives", "施策名・展開への所属・並び順", "id", "name", "expansion_id", "sort_order"), rows, primary, overrides, previous, accounts, classifications[0]!, selection],
    calculated: [resolved, "施策の売上・利益の増減を展開ごとにまとめ、前年から予算への積み上げを表示します。2種比較は確定予算−一次予算です。四半期・上期・下期・年間の計は丸める前の売上・利益を期間内で合算し、属性未設定も引き継ぎます。展開表専用の保存テーブルはありません。", rounded, blankZero] },
  { page: "details", name: "明細", tables: [...initiativeTables, previous],
    calculated: [resolved, "施策・科目行・月・種別を組み合わせて明細行を作ります。前年行は previous_amounts から作ります。明細専用の保存テーブルはありません。", rounded] },
  { page: "account-master", name: "勘定科目マスタ", tables: [plan, accounts], calculated: [] },
  { page: "aggregation-master", name: "集計マスタ", tables: [plan, groups, members, accounts], calculated: ["科目または子集計を所属先に結び、加算・減算と並び順を保存します。"] },
  ...classifications.map((item, index) => ({ page: (["expansion-master", "industry-master", "department-master", "period-master"] as const)[index]!,
    name: ["展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ"][index]!,
    tables: [plan, use(item.table, dataTables.find(table => table.name === item.table)!.label + "の登録情報", ...dataMapSchema.find(table => table.name === item.table)!.columns.map(column => column.name))], calculated: [] })),
  { page: "kind-master", name: "種別マスタ", tables: [plan], calculated: ["前年・一次予算・確定予算はアプリの固定定義です。種別マスタの保存テーブルはありません。前年実額は previous_amounts、一次予算は initiative_amounts、確定予算の手修正は amount_overrides に保存します。"] },
  { page: "data-history", name: "履歴", tables: [plan, use("data_history", "記録日時と計画全体の保存内容", "id", "recorded_at", "snapshot"),
    use("data_history_state", "記録の識別子と未記録の変更を管理", "next_id", "dirty_since", "saved_at", "version")],
    calculated: ["過去閲覧では snapshot 内の計画テーブルを読み込みます。画面の移動履歴と操作の取り消し・やり直しはメモリ内に保持し、これらのテーブルへ保存しません。"] },
];
