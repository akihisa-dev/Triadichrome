import assert from "node:assert/strict";
import ExcelJS from "exceljs";

// Independent arithmetic: do not call production amount/effect/total helpers to build the oracle.
const yen = text => { const [whole, fraction = ""] = String(text).replace(/^-/, "").split("."); return (String(text).startsWith("-") ? -1 : 1) * (Number(whole) * 1000 + Number(fraction.padEnd(3, "0"))); };
export async function verifyReferenceSample(api, bytes, plan) {
  assert.ok(bytes.length <= 50_000_000, `履歴込み実ファイルのサイズ: ${bytes.length}`);
  const before = bytes.slice();
  const accounts = new Map(plan.accounts.map(item => [item.id,item]));
  const effect = (values, accountId, value) => {
    const type = accounts.get(accountId).accountType;
    if (type === "sales") { values.sales += value; values.profit += value; }
    if (type === "cost") { values.sales -= value; values.profit -= value; }
    if (type === "expense") { values.expense += value; values.profit -= value; }
    if (type === "profit") values.profit += value;
  };
  const empty = () => ({sales:0,expense:0,profit:0});
  const value = (row, kind, month) => yen(kind === 2 && Object.hasOwn(row.overrides?.[2] ?? {},month) ? row.overrides[2][month] : row.amounts[month] ?? "0");
  const monthly = (item,kind,month) => { const result=empty(); for(const row of item.rows) effect(result,row.accountId,value(row,kind,month)); return result; };
  const catalog=plan.initiatives.filter(item=>item.rows[0]?.id?.startsWith("portfolio:"));
  assert.equal(catalog.length,126);
  assert.equal(plan.initiatives.length,140);
  assert.equal(new Set(catalog.map(item=>`${item.expansionId}/${item.industryId}/${item.departmentId}`)).size,126);
  assert.equal(new Set(catalog.map(item=>item.note)).size,126);
  for(const item of catalog) {
    assert.ok(item.note.length>=80 && !item.name.includes("大規模確認"),item.name);
    assert.equal(item.rows.length,6);
    assert.ok(item.rows.some(row=>Object.values(row.amounts).some(amount=>yen(amount)!==0)),"名前だけの施策を拒否");
    for(const kind of [1,2]) assert.ok(api.initiativeMonths.some(month=>Object.values(monthly(item,kind,month)).some(amount=>amount!==0)),"全月相殺の水増しを拒否");
    assert.equal(item.rows[0].overrides[2][4],item.rows[0].amounts[4],"同額の明示上書き");
    assert.equal(item.rows[0].overrides[2][3],"0","年度末の明示0");
    assert.ok(!Object.hasOwn(item.rows[0].overrides[2],5),"未指定の追従月を残す");
  }
  const costId=plan.expansions.find(item=>item.expansionName==="コスト").id;
  for(const name of ["下払いUP","ベースアップ","設備投資","燃料費UP","電気料金UP"]) {
    const id=plan.expansionCategories.find(item=>item.categoryName===name).id;
    assert.ok(catalog.some(item=>item.expansionId===costId&&item.expansionCategoryId===id),`${name}の実施策`);
  }
  const first=catalog.find(item=>item.name==="車両整備・契約単価の見直し・東");
  assert.deepEqual(monthly(first,1,4),{sales:4920,expense:5249,profit:-329});
  assert.deepEqual(monthly(first,2,10),{sales:7640,expense:6249,profit:1391});
  for(const industryId of new Set(catalog.map(item=>item.industryId))) {
    const pair=catalog.filter(item=>item.industryId===industryId&&item.name.includes("担当業務の移管"));
    assert.equal(pair.length,2);
    for(const kind of [1,2]) for(const month of api.initiativeMonths) {
      const a=monthly(pair[0],kind,month),b=monthly(pair[1],kind,month);
      assert.deepEqual({sales:a.sales+b.sales,expense:a.expense+b.expense,profit:a.profit+b.profit},empty(),"移管は分類ごとの実額と全体の整合を保つ");
    }
  }
  const shape=catalog.find(item=>item.name==="車両整備・新規顧客の開拓・東");
  assert.equal(shape.startYearMonths[1],`${plan.fiscalYear}-07`);
  assert.equal(shape.rows[0].amounts[4],"0");
  assert.ok(yen(shape.rows[0].amounts[12])>yen(shape.rows[0].amounts[11]),"繁忙期の受注増");
  const adjustments=catalog.find(item=>item.name==="車両整備・サービス料金改定・東");
  assert.equal(adjustments.startYearMonths[1],`${plan.fiscalYear}-10`);
  for(const kind of [1,2]) {
    const projected=api.initiativesForKind(plan.initiatives,plan.accounts,kind);
    for(const item of projected) for(const month of api.initiativeMonths) assert.deepEqual(item.months[month],monthly(plan.initiatives.find(source=>source.id===item.id),kind,month));
  }
  const expansion=api.buildKindExpansionTable(plan,[1,2],"registered");
  const costs=api.buildKindCostTable(plan,[1,2]);
  const prior=month=>{const result=empty();for(const row of plan.previousAmounts.filter(row=>row.month===month))effect(result,row.accountId,yen(row.amount));return result;};
  const expectations={};
  for(const [index,kind] of [1,2].entries()) for(const month of api.initiativeMonths) {
    const expected=prior(month); for(const item of plan.initiatives) {const amount=monthly(item,kind,month);for(const field of Object.keys(expected))expected[field]+=amount[field];}
    expectations[`${kind}/${month}`]=expected;
    assert.deepEqual(expansion.total[index][month],{sales:expected.sales,profit:expected.profit});
    const sales=costs.find(row=>row.kind==="group" && row.id===plan.aggregations.find(group=>group.required==="sales").id),profit=costs.find(row=>row.kind==="group" && row.id===plan.aggregations.find(group=>group.required==="ordinary").id);
    assert.equal(sales.values[index+1][month],expected.sales);assert.equal(profit.values[index+1][month],expected.profit);
  }
  for(const period of api.previousPeriods) {
    const sales=costs.find(row=>row.kind==="group" && row.id===plan.aggregations.find(group=>group.required==="sales").id),profit=costs.find(row=>row.kind==="group" && row.id===plan.aggregations.find(group=>group.required==="ordinary").id);
    const expected=period.months.reduce((sum,month)=>sum+prior(month).sales,0);
    assert.equal(api.previousPeriodAmount(sales,period,sales,profit),expected);
    for(const [index,kind] of [1,2].entries()) {
      const total=period.months.reduce((sum,month)=>sum+expectations[`${kind}/${month}`].sales,0);
      assert.equal(api.expansionPeriodAmount(expansion.total[index],period,"sales"),total);
    }
  }
  const db=await api.openTriadicDatabase(bytes);
  try {assert.equal(db.exec("PRAGMA integrity_check")[0].values[0][0],"ok");assert.deepEqual(db.exec("PRAGMA foreign_key_check"),[]);}finally{db.close();}
  const history=await api.readDataHistory(bytes);
  const snapshots=[];
  for(const entry of history.entries) {const snapshot=await api.readSnapshotContents(await api.readHistorySnapshot(bytes,entry.id));assert.equal(snapshot.initiatives.length,140);snapshots.push(snapshot.initiatives[0].rows[0].amounts[4]);}
  assert.deepEqual(snapshots.sort(),["100","110","120"]);
  // Edit only a private copy: explicit equal/zero records remain independent of primary values.
  const changedDraft={...first,fiscalYear:String(plan.fiscalYear),rows:structuredClone(first.rows)};
  changedDraft.rows[0].amounts[4]="120";
  changedDraft.rows[0].amounts[3]="120";
  let edited=await api.updateInitiative(bytes,first.id,plan.fiscalYear,changedDraft);
  let reloaded=(await api.readPlanContents(edited)).initiatives.find(item=>item.id===first.id);
  assert.equal(reloaded.rows[0].amounts[4],"120");
  assert.equal(reloaded.rows[0].overrides[2][4],"0","同額の明示0は一次更新後も維持");
  assert.equal(reloaded.rows[0].overrides[2][3],"0","年度末の明示0も維持");
  const cleared={...reloaded,fiscalYear:String(plan.fiscalYear),rows:structuredClone(reloaded.rows)};
  delete cleared.rows[0].overrides[2][4];
  edited=await api.updateInitiative(edited,first.id,plan.fiscalYear,cleared);
  reloaded=(await api.readPlanContents(edited)).initiatives.find(item=>item.id===first.id);
  assert.ok(!Object.hasOwn(reloaded.rows[0].overrides[2],4));
  assert.equal(api.initiativesForKind([reloaded],plan.accounts,2)[0].rows[0].amounts[4],"120","解除後は一次へ追従");
  const workbook=await api.serializeWorkbook(api.createReportWorkbook(plan,{tables:["cost-table","expansion-table","initiative-list"],selections:{"cost-table":[1,2],"expansion-table":[1,2],"initiative-list":[1]},costFilter:{industries:null,departments:null}}));
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(workbook);
  assert.ok(reopened.getWorksheet("総原価表")&&reopened.getWorksheet("展開表")&&reopened.getWorksheet("施策一覧")&&reopened.getWorksheet("計算元"));
  const calculation=reopened.getWorksheet("計算元");
  assert.ok(calculation.rowCount>140,"実サンプルの明細を出力");
  assert.deepEqual(bytes,before,"履歴読込・出力で実サンプルを変更しない");
  console.log(`PASS: 新基準サンプル ${bytes.length} bytes、126実務施策、全分類・初期5区分、独立計算した三表/期間計、履歴3時点、Excel出力再読込`);
  console.log("REFERENCE_EXPECTATIONS",JSON.stringify({aprilPrimary:expectations["1/4"],aprilConfirmed:expectations["2/4"],annualPrimarySales:api.initiativeMonths.reduce((sum,m)=>sum+expectations[`1/${m}`].sales,0)}));
}
