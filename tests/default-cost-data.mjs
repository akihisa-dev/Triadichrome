import assert from "node:assert/strict";

const expectedAccounts = [
  ["401", "売上高"], ["403", "グループ売上高"], ["405", "本支店売上高"], ["407", "店内売上高"],
  ["593", "本支店売上原価"], ["595", "店内売上原価"], ["537", "旅費"], ["549", "通信運搬費"],
  ["539", "交際費"], ["541", "会議費"], ["551", "動力光熱費"], ["553", "燃料油脂費"],
  ["555", "消耗品費"], ["573", "修繕費"], ["554", "タイヤチューブ費"], ["575", "通行乗船料"],
  ["557", "下払運賃"], ["559", "下払鉄道運賃"], ["561", "継配費"], ["563", "下払作業賃"],
  ["565", "再保管料"], ["571", "外注費"], ["579", "事故費"], ["569", "ＥＤＰ処理料"],
  ["585", "雑費"], ["544", "研修教育費"], ["545", "諸負担金"], ["583", "諸手数料"],
  ["577", "港・貨物費"], ["543", "寄付金"], ["547", "宣伝広告費"], ["548", "研究開発費"],
  ["519", "期首商品棚卸高"], ["523", "商品仕入高"], ["526", "期末商品棚卸高"], ["670", "商事物流費"],
  ["663", "貸倒引当金繰入額"], ["665", "貸倒損失"], ["661", "販売手数料"], ["525", "商品評価・減耗損"],
  ["501", "給料手当"], ["502", "役員報酬"], ["503", "賞与"], ["505", "退職金"],
  ["513", "法定福利費"], ["515", "厚生福利費"], ["517", "臨時傭員費"], ["527", "固定資産減価償却費"],
  ["528", "リース資産償却費"], ["529", "保険料"], ["530", "除去債務利息費用"], ["533", "賃借料"],
  ["534", "借船料"], ["535", "リース料"], ["531", "租税公課"], ["713", "営業外収益"], ["731", "営業外費用"],
];

export async function verifyDefaultCostData(api) {
  const { createTriadicDatabase, readPlanContents, buildCostTable, registerInitiative, updateInitiative,
    changeAggregationMaster, changeAccountMaster, openTriadicDatabase, validateTriadicDatabase,
    createEmptyTestPlan, formatAmount, formatRate, isValidAmount } = api;
  const bytes = await createTriadicDatabase();
  await validateTriadicDatabase(bytes);
  const defaults = await readPlanContents(bytes);
  assert.deepEqual(defaults.accounts.map(a => [a.accountCode, a.accountName]), expectedAccounts);
  assert.deepEqual(defaults.accounts.map((a, i) => a.accountType), expectedAccounts.map((a, i) => i < 4 ? "sales" : i < 6 ? "cost" : a[0] === "713" ? "profit" : "expense"));
  assert.equal(defaults.aggregations.length, 15);
  assert.equal(defaults.initiatives.length, 0);
  assert.deepEqual((await readPlanContents(await createTriadicDatabase())).accounts, defaults.accounts, "すべての新規ファイルに同じデフォルトを用意する");
  const empty = buildCostTable(defaults.accounts, defaults.aggregations, [], 2026);
  const expectedRows = [];
  const endings = new Map([
    [1, ["小計"]], [3, ["小計", "合計"]], [5, ["小計", "社内控除後売上"]],
    [9, ["小計"]], [39, ["小計", "合計"]], [46, ["小計"]],
    [54, ["小計", "合計", "原価計", "営業利益"]], [56, ["営業外収益計", "経常利益", "利益率"]],
  ]);
  expectedAccounts.forEach(([, name], i) => expectedRows.push(name, ...(endings.get(i) ?? [])));
  assert.deepEqual(empty.map(row => row.name), expectedRows, "全科目・全集計の表示順が承認された配置と一致");
  assert.ok(empty.every(row => row.configured), "新規作成時に集計が設定済み");
  assert.ok(empty.every(row => !Object.keys(row.budget).length && !Object.keys(row.previous).length && !Object.keys(row.comparison).length));

  const draft = { name: "全科目の集計確認", note: "", fiscalYear: "2026", rows: defaults.accounts.map(a => ({ accountId: a.id, amounts: { 4: "100", 5: "0", 3: "-0.001" } })) };
  const registered = await registerInitiative(bytes, draft);
  const contents = await readPlanContents(registered);
  const baseline = new Map(defaults.accounts.map((a, i) => [a.id, { 4: i < 4 ? 1000 : i < 6 ? 100 : a.accountCode === "713" ? 30 : a.accountCode === "731" ? 20 : 10 }]));
  const table = buildCostTable(contents.accounts, contents.aggregations, contents.initiatives, 2026, baseline);
  const subtotals = table.filter(row => row.kind !== "account");
  assert.deepEqual(subtotals.map(row => row.budget[4]), [
    2200, 2200, 4400, 400, 4000, 440, 3300, 3740, 770, 880, 1650, 5390, -1390, 10, -1380, -34.5,
  ], "確認した全集計式の計算結果");
  assert.deepEqual(subtotals.map(row => row.comparison[4]).slice(0, -1), [-200, -200, -400, -200, -200, -400, -3000, -3400, -700, -800, -1500, -4900, 4700, 0, 4700]);
  const rate = table.at(-1);
  assert.equal(rate.previous[4], 3320 / 3800 * 100);
  assert.equal(rate.comparison[4], rate.previous[4] - rate.budget[4], "対予算は前年−予算のパーセントポイント");
  assert.equal(formatRate(rate.comparison[4], true), "121.9pt");
  assert.equal(formatRate(rate.budget[4]), "-34.5%");
  assert.equal(rate.budget[5], undefined, "売上ゼロの利益率は空欄");
  assert.equal(rate.comparison[5], undefined);
  assert.equal(table[0].budget[5], 0);
  assert.equal(table[0].comparison[5], undefined, "前年未登録は差額も空欄");
  assert.equal(table[0].budget[3], -0.001);
  assert.equal(table[0].budget[6], undefined);
  assert.equal(formatAmount(-0.001), "-0.001");
  assert.equal(formatRate(1.25), "1.3%");
  assert.equal(formatRate(-1.25), "-1.3%");
  assert.equal(formatRate(undefined), "");
  assert.equal(formatAmount(undefined), "");

  for (const amount of ["0.001", "-0.001", "0", "1234.567"]) assert.equal(isValidAmount(amount), true);
  for (const amount of ["0.0001", "-1.2345", "NaN", "Infinity", " ", "9007199254740991"]) {
    assert.equal(isValidAmount(amount), false);
    await assert.rejects(registerInitiative(bytes, { ...draft, rows: [{ accountId: defaults.accounts[0].id, amounts: { 4: amount } }] }), /金額/);
  }
  await assert.rejects(updateInitiative(registered, contents.initiatives[0].id, 2026, { ...draft, rows: draft.rows.map((row, i) => i === 0 ? { ...row, amounts: { 4: "0.0001" } } : row) }), /3桁/);
  const precise = await registerInitiative(bytes, { ...draft, rows: [
    { accountId: defaults.accounts[0].id, amounts: { 4: "0.1", 5: "-0.001" } },
    { accountId: defaults.accounts[0].id, amounts: { 4: "0.2", 5: "0.001" } },
  ] });
  const precision = await readPlanContents(precise);
  const preciseTable = buildCostTable(precision.accounts, precision.aggregations, precision.initiatives, 2026);
  assert.equal(preciseTable[0].budget[4], 0.3, "1円精度の加算で浮動小数点の誤差を出さない");
  assert.equal(preciseTable[0].budget[5], 0);
  const first = defaults.aggregations[0];
  const renamed = await changeAggregationMaster(bytes, { type: "update", id: first.id, name: first.name, displayName: "確認用小計", members: first.members });
  assert.equal((await readPlanContents(renamed)).aggregations[0].displayName, "確認用小計");
  await assert.rejects(changeAggregationMaster(bytes, { type: "update", id: first.id, name: first.name, displayName: " ", members: first.members }), /表示名/);

  // A genuine v5 file gets only the new optional column, never default accounts/groups.
  const oldBytes = await createEmptyTestPlan();
  const oldContents = await readPlanContents(oldBytes);
  const oldDb = await openTriadicDatabase(oldBytes);
  const beforeTables = ["accounts", "aggregation_groups", "aggregation_members", "initiatives", "details"].map(name => [name, oldDb.exec(`SELECT * FROM ${name}`)]);
  oldDb.close();
  const migrated = await changeAccountMaster(oldBytes, { type: "add", accountCode: "001", accountName: "独自科目", accountType: "expense" });
  assert.equal(migrated.accounts.length, 1);
  assert.equal((await readPlanContents(migrated.bytes)).aggregations.length, oldContents.aggregations.length);
  const untouched = await openTriadicDatabase(oldBytes);
  assert.equal(untouched.exec("PRAGMA user_version")[0].values[0][0], 5);
  assert.deepEqual(["accounts", "aggregation_groups", "aggregation_members", "initiatives", "details"].map(name => [name, untouched.exec(`SELECT * FROM ${name}`)]), beforeTables);
  untouched.close();
  console.log("PASS: approved default accounts/codes/order, all subtotal formulas, prior-minus-budget, rate/zero/rounding, yen precision, validation and non-destructive legacy migration");
}
