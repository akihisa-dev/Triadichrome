// This catalog describes the saved schema, not a second copy of plan data.
export type DataColumn = { name: string; label: string; reference?: string };
export type DataTable = { name: string; label: string; columns: DataColumn[] };
const table = (name: string, label: string, fields: [string, string, string?][]): DataTable => ({ name, label,
  columns: fields.map(([name, label, reference]) => ({ name, label, ...(reference ? { reference } : {}) })) });
const id: [string, string] = ["id", "識別子"];
const revision: [string, string] = ["revision", "更新番号"];
const order: [string, string] = ["sort_order", "並び順"];
const month: [string, string] = ["month", "月"];
const amount: [string, string] = ["amount_yen", "金額（円）"];
const account: [string, string, string] = ["account_id", "勘定科目", "accounts.id"];
const industry: [string, string, string] = ["industry_id", "業種", "industries.id"];
const department: [string, string, string] = ["department_id", "部署", "departments.id"];
const row: [string, string, string] = ["row_id", "施策の科目行", "initiative_rows.id"];
export const dataTables: DataTable[] = [
  table("plan", "計画", [id, ["fiscal_year", "基準年度"], ["created_at", "作成日時"], ["updated_at", "更新日時"]]),
  table("initiatives", "施策", [id, ["name", "施策名"], ["note", "備考"], ["expansion_id", "展開", "expansions.id"], industry, department,
    ["period_type_id", "期間", "period_types.id"], ["primary_start_year_month", "一次予算の開始年月"], ["confirmed_start_year_month", "確定予算の開始年月"], order, revision]),
  table("initiative_rows", "施策の科目行", [["id", "科目行の識別子"], ["initiative_id", "施策", "initiatives.id"], account, order, revision]),
  table("initiative_amounts", "一次予算の月別増減", [row, month, amount, revision]),
  table("amount_overrides", "確定予算の手修正", [row, month, amount, revision]),
  table("previous_amounts", "前年の実額", [id, account, industry, department, month, amount, revision]),
  table("accounts", "勘定科目", [id, ["code", "科目コード"], ["attribute", "科目属性"], ["name", "科目名"], order]),
  table("aggregation_groups", "集計", [id, ["display_name", "表示名"], ["name", "集計名"], ["required_key", "必須集計の役割"], order]),
  table("aggregation_members", "集計の所属・加減算", [["parent_id", "所属先の集計", "aggregation_groups.id"], account,
    ["group_id", "子集計", "aggregation_groups.id"], ["sign", "加算・減算"], ["position", "所属内の並び順"]]),
  table("expansions", "展開", [id, ["code", "展開コード"], ["name", "展開名"]]),
  table("industries", "業種", [id, ["code", "業種コード"], ["name", "業種名"]]),
  table("departments", "部署", [id, ["name", "部署名"]]),
  table("period_types", "期間", [id, ["name", "期間名"], ["start_month_rule", "開始年月の算出規則"]]),
  table("kind_selections", "画面ごとの種別選択", [["screen", "画面"], ["first_kind", "比較対象1・表示種別"], ["second_kind", "比較対象2"]]),
  table("data_history", "時点履歴", [id, ["recorded_at", "記録日時"], ["snapshot", "計画全体の保存内容"]]),
  table("data_history_state", "履歴の記録状態", [id, ["version", "履歴管理の版"], ["next_id", "次の履歴識別子"], ["dirty_since", "未記録の変更の開始日時"], ["saved_at", "最新の保存日時"]]),
  table("triadic_metadata", "ファイル形式", [["key", "情報名"], ["value", "値"]]),
];
export type TableUse = { table: string; purpose: string; fields: string[] };
export type ScreenData = { page: string; name: string; tables: TableUse[]; calculated: string[] };
const use = (table: string, purpose: string, ...fields: string[]): TableUse => ({ table, purpose, fields });
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
const initiativeTables = [plan, initiative, rows, primary, overrides, accounts, ...classifications];
export const screenData: ScreenData[] = [
  { page: "initiative-list", name: "施策一覧", tables: [plan, use("initiatives", "施策名・備考の吹き出し・種別ごとの開始年月・並び順", "id", "name", "note", "primary_start_year_month", "confirmed_start_year_month", "sort_order"), rows, primary, overrides, accounts, use("kind_selections", "施策一覧の表示種別", "screen", "first_kind")],
    calculated: [resolved, "月別の売上・費用・利益は科目行の有効金額と科目属性から求めます。集計結果の保存テーブルはありません。", rounded] },
  { page: "initiative-entry", name: "施策入力", tables: initiativeTables,
    calculated: ["登録前の入力は画面内で保持し、登録時に施策・科目行・月別金額へ保存します。", resolved, "開始年月は期間の算出規則と種別ごとの月別増減から求め、施策へ保存します。", rounded] },
  { page: "initiative-detail", name: "施策詳細", tables: initiativeTables,
    calculated: [resolved, "開始年月は期間の算出規則と種別ごとの月別増減から再算出し、施策へ保存します。", rounded] },
  { page: "previous-input", name: "前年入力", tables: [plan, previous, accounts, classifications[1]!, classifications[2]!],
    calculated: ["選択した業種・部署に対応する科目別の月額を表示し、前年の実額を更新します。", rounded] },
  { page: "cost-table", name: "総原価表", tables: [plan, previous, use("initiatives", "施策ごとの科目行をまとめる", "id"), rows, primary, overrides, accounts, groups, members, selection],
    calculated: [resolved, "科目ごとに施策の増減を合計し、前年の実額に加えて予算を求めます。集計行は所属と加減算から求め、総原価表専用の保存テーブルはありません。", rounded] },
  { page: "expansion-table", name: "展開表", tables: [plan, use("initiatives", "施策名・展開への所属・並び順", "id", "name", "expansion_id", "sort_order"), rows, primary, overrides, previous, accounts, classifications[0]!, selection],
    calculated: [resolved, "施策の売上・利益の増減を展開ごとにまとめ、前年から予算への積み上げを表示します。2種比較は確定予算−一次予算です。展開表専用の保存テーブルはありません。", rounded] },
  { page: "details", name: "明細", tables: [...initiativeTables, previous],
    calculated: [resolved, "施策・科目行・月・種別を組み合わせて明細行を作ります。前年行は previous_amounts から作ります。明細専用の保存テーブルはありません。", rounded] },
  { page: "account-master", name: "勘定科目マスタ", tables: [plan, accounts], calculated: [] },
  { page: "aggregation-master", name: "集計マスタ", tables: [plan, groups, members, accounts], calculated: ["科目または子集計を所属先に結び、加算・減算と並び順を保存します。"] },
  ...classifications.map((item, index) => ({ page: ["expansion-master", "industry-master", "department-master", "period-master"][index]!,
    name: ["展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ"][index]!,
    tables: [plan, use(item.table, dataTables.find(table => table.name === item.table)!.label + "の登録情報", ...dataTables.find(table => table.name === item.table)!.columns.map(column => column.name))], calculated: [] })),
  { page: "kind-master", name: "種別マスタ", tables: [plan], calculated: ["前年・一次予算・確定予算はアプリの固定定義です。種別マスタの保存テーブルはありません。前年実額は previous_amounts、一次予算は initiative_amounts、確定予算の手修正は amount_overrides に保存します。"] },
  { page: "data-history", name: "履歴", tables: [plan, use("data_history", "記録日時と計画全体の保存内容", "id", "recorded_at", "snapshot"),
    use("data_history_state", "記録の識別子と未記録の変更を管理", "next_id", "dirty_since", "saved_at", "version")],
    calculated: ["過去閲覧では snapshot 内の計画テーブルを読み込みます。画面の移動履歴と操作の取り消し・やり直しはメモリ内に保持し、これらのテーブルへ保存しません。"] },
];
