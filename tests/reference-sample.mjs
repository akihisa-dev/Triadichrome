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
  const amountSignatures=catalog.map(item=>JSON.stringify(item.rows.map(row=>[
    row.accountId,api.initiativeMonths.map(month=>row.amounts[month]),
    api.initiativeMonths.map(month=>Object.hasOwn(row.overrides?.[2]??{},month)?row.overrides[2][month]:null),
  ])));
  assert.equal(new Set(amountSignatures).size,126,"名称・分類・備考を除いた金額パターンも126件すべて異なる");
  for(const item of catalog) {
    assert.ok(item.note.length>=80 && !item.name.includes("大規模確認"),item.name);
    assert.ok(item.rows.length >= 1 && item.rows.length <= 5);
    assert.ok(item.rows.some(row=>Object.values(row.amounts).some(amount=>yen(amount)!==0)),"名前だけの施策を拒否");
    for(const kind of [1,2]) assert.ok(api.initiativeMonths.some(month=>Object.values(monthly(item,kind,month)).some(amount=>amount!==0)),"全月相殺の水増しを拒否");
  }
  const sourceRow=(item,name)=>item.rows.find(row=>accounts.get(row.accountId).accountName===name);
  const costId=plan.expansions.find(item=>item.expansionName==="コスト").id;
  const categories=new Map(plan.expansionCategories.map(item=>[item.categoryName,item.id]));
  const requiredAccounts={"下払いUP":"下払作業賃","ベースアップ":"給料手当","設備投資":"固定資産減価償却費","燃料費UP":"燃料油脂費","電気料金UP":"動力光熱費"};
  for(const [name,accountName] of Object.entries(requiredAccounts)) {
    const items=catalog.filter(item=>item.expansionId===costId&&item.expansionCategoryId===categories.get(name));
    assert.ok(items.length>0,`${name}の実施策`);
    for(const item of items) {
      assert.ok(item.note.includes(name));
      const row=sourceRow(item,accountName);
      assert.ok(row,`${name}は${accountName}に計上`);
      assert.ok(Object.values(row.amounts).some(amount=>yen(amount)>0),"費用UP・償却の科目は正額");
      assert.ok(Object.values(row.amounts).every(amount=>yen(amount)>=0));
      assert.ok(item.rows.every(row=>accounts.get(row.accountId).accountType==="expense"),"費用UPに売上増や架空の収益を混ぜない");
      for(const kind of [1,2]) for(const month of api.initiativeMonths) {
        const amount=monthly(item,kind,month);
        assert.equal(amount.sales,0);
        assert.ok(amount.expense>=0);
        assert.equal(amount.profit+amount.expense,0);
      }
    }
  }
  const first=catalog.find(item=>item.name==="車両整備・委託作業単価の上昇・東");
  assert.equal(sourceRow(first,"下払作業賃").amounts[4],"8","10件×追加単価800円");
  assert.equal(value(sourceRow(first,"下払作業賃"),2,7),13500,"繁忙15件×確定単価900円");
  assert.deepEqual(monthly(first,1,4),{sales:0,expense:8000,profit:-8000});
  const payroll=catalog.find(item=>item.name==="車両整備・給与ベースアップ・西");
  assert.equal(value(sourceRow(payroll,"給料手当"),1,4),15000,"5名×昇給3000円");
  assert.equal(value(sourceRow(payroll,"法定福利費"),2,7),2625,"5名×3500円×15%");
  const equipment=catalog.find(item=>item.name==="法人車両・洗車設備の更新・東");
  assert.equal(value(sourceRow(equipment,"固定資産減価償却費"),1,10),22000,"取得132万円/60か月");
  assert.equal(value(sourceRow(equipment,"固定資産減価償却費"),2,10),0,"納期延期で10月償却なし");
  assert.equal(value(sourceRow(equipment,"固定資産減価償却費"),2,11),19800,"確定取得額10%減/60か月");
  assert.equal(value(sourceRow(equipment,"修繕費"),1,10),-2100);
  assert.equal(value(sourceRow(equipment,"修繕費"),2,10),0,"旧設備は延期中稼働し削減しない");
  assert.equal(value(sourceRow(equipment,"消耗品費"),1,9),19000);
  assert.equal(value(sourceRow(equipment,"消耗品費"),2,9),0);
  assert.equal(value(sourceRow(equipment,"消耗品費"),2,10),19000,"準備費も実施月へ移す");
  assert.ok(equipment.note.includes("二重計上せず"));
  const fuel=catalog.find(item=>item.name==="法人車両・燃料単価の上昇・西");
  assert.equal(value(sourceRow(fuel,"燃料油脂費"),1,7),6750,"450L×15円");
  assert.equal(value(sourceRow(fuel,"燃料油脂費"),2,10),6300,"350L×18円");
  const power=catalog.find(item=>item.name==="月極賃貸・電気契約料金の上昇・東");
  assert.equal(value(sourceRow(power,"動力光熱費"),1,7),4500,"冷房1500kWh×3円");
  assert.equal(value(sourceRow(power,"動力光熱費"),2,7),0,"更新延期で7月費用UPなし");
  assert.equal(value(sourceRow(power,"動力光熱費"),2,9),4800,"9月1200kWh×4円");
  for(const industryId of new Set(catalog.map(item=>item.industryId))) {
    const pair=catalog.filter(item=>item.industryId===industryId&&item.name.includes("担当業務の移管"));
    assert.equal(pair.length,2);
    for(const kind of [1,2]) for(const month of api.initiativeMonths) {
      assert.ok(pair[0].note.includes(pair[1].name)&&pair[1].note.includes(pair[0].name));
      for(const row of pair[0].rows) {
        const counterpart=pair[1].rows.find(other=>other.accountId===row.accountId);
        assert.ok(counterpart);
        assert.equal(value(row,kind,month)+value(counterpart,kind,month),0,"移管は科目・月・種別ごとに対の実額を保持");
        if(kind===2 && [4,5,6].includes(month)) assert.equal(value(row,kind,month),0,"引継延期中の移管は0");
      }
      const a=monthly(pair[0],kind,month),b=monthly(pair[1],kind,month);
      assert.deepEqual({sales:a.sales+b.sales,expense:a.expense+b.expense,profit:a.profit+b.profit},empty(),"移管は分類ごとの実額と全体の整合を保つ");
    }
  }
  const shape=catalog.find(item=>item.name==="車両整備・新規顧客の開拓・東");
  assert.equal(shape.startYearMonths[1],`${plan.fiscalYear}-07`);
  assert.equal(shape.startYearMonths[2],`${plan.fiscalYear}-08`);
  for(const item of catalog) {
    const expansionName=plan.expansions.find(expansion=>expansion.id===item.expansionId).expansionName;
    if(expansionName==="料改") {
      for(const row of item.rows) for(const kind of [1,2]) for(const month of [4,5,6,7,8,9]) assert.equal(value(row,kind,month),0,"料金改定前の全行は0");
      for(const row of item.rows) assert.equal(value(row,2,10),0,"確定料金改定は11月開始");
      assert.equal(item.startYearMonths[1],`${plan.fiscalYear}-10`);
      assert.equal(item.startYearMonths[2],`${plan.fiscalYear}-11`);
    }
    if(expansionName==="撤退") {
      for(const kind of [1,2]) for(const month of api.initiativeMonths) {
        assert.ok(value(sourceRow(item,"売上高"),kind,month)<=0);
        for(const name of ["本支店売上原価","給料手当","賃借料"]) assert.ok(value(sourceRow(item,name),kind,month)<=0);
      }
      for(const row of item.rows) for(const month of [7,8]) assert.equal(value(row,2,month),0,"撤退延期中に削減を先取りしない");
      for(const kind of [1,2]) {
        const lostSales=-value(sourceRow(item,"売上高"),kind,12);
        assert.equal(-value(sourceRow(item,"本支店売上原価"),kind,12),Math.round(lostSales*0.75));
        assert.equal(-value(sourceRow(item,"給料手当"),kind,12),Math.round(lostSales*0.22));
        assert.equal(-value(sourceRow(item,"賃借料"),kind,12),Math.round(lostSales*0.08));
        assert.ok(monthly(item,kind,12).profit>0,"赤字契約終了後は継続赤字を解消");
      }
    }
    if(expansionName==="物量") {
      const decemberDifference=name=>value(sourceRow(item,name),2,12)-value(sourceRow(item,name),1,12);
      assert.equal(decemberDifference("売上高"),12000);
      assert.equal(decemberDifference("本支店売上原価"),4200);
      assert.equal(decemberDifference("通信運搬費"),720);
      assert.equal(decemberDifference("臨時傭員費"),1200,"追加6件の数量を関連費用にも反映");
    }
    if(expansionName==="拡販") {
      for(const row of item.rows) assert.equal(value(row,2,7),0,"新規契約延期の7月は全行0");
      assert.ok(value(sourceRow(item,"宣伝広告費"),2,8)>value(sourceRow(item,"宣伝広告費"),1,8),"初月販促を8月へ移す");
      assert.equal(value(sourceRow(item,"営業外収益"),2,3),5001,"助成の交付時期は維持");
    }
    if(expansionName==="効率") {
      for(const name of ["下払作業賃","給料手当","通信運搬費"]) {
        assert.ok(value(sourceRow(item,name),1,6)<0);
        assert.equal(value(sourceRow(item,name),2,6),0,"定着前は費用削減しない");
        assert.ok(value(sourceRow(item,name),2,7)<0);
      }
      assert.equal(value(sourceRow(item,"営業外収益"),2,12),0,"助成不成立は明示0");
      assert.ok(Object.hasOwn(sourceRow(item,"営業外収益").overrides[2],12));
    }
  }
  const adjustments=catalog.find(item=>item.name==="車両整備・サービス料金改定・東");
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
  for(const entry of history.entries) {
    const snapshot=await api.readSnapshotContents(await api.readHistorySnapshot(bytes,entry.id));
    assert.equal(snapshot.initiatives.length,140);
    const snapshotCatalog=snapshot.initiatives.filter(item=>item.rows[0]?.id?.startsWith("portfolio:"));
    assert.deepEqual(snapshotCatalog.map(item=>({name:item.name,note:item.note,rows:item.rows})),catalog.map(item=>({name:item.name,note:item.note,rows:item.rows})),"3時点とも改訂した実務データを保持");
    snapshots.push(snapshot.initiatives[0].rows[0].amounts[4]);
  }
  assert.deepEqual(snapshots.sort(),["100","110","120"]);
  // Edit only a private copy: explicit equal/zero records remain independent of primary values.
  const changedDraft={...first,fiscalYear:String(plan.fiscalYear),rows:structuredClone(first.rows)};
  changedDraft.rows[0].amounts[4]="120";
  let edited=await api.updateInitiative(bytes,first.id,plan.fiscalYear,changedDraft);
  let reloaded=(await api.readPlanContents(edited)).initiatives.find(item=>item.id===first.id);
  assert.equal(reloaded.rows[0].amounts[4],"120");
  assert.equal(reloaded.rows[0].overrides[2][4],"8","同額の明示上書きは一次更新後も維持");
  const zeroDraft={...adjustments,fiscalYear:String(plan.fiscalYear),rows:structuredClone(adjustments.rows)};
  zeroDraft.rows[0].amounts[10]="120";
  edited=await api.updateInitiative(bytes,adjustments.id,plan.fiscalYear,zeroDraft);
  reloaded=(await api.readPlanContents(edited)).initiatives.find(item=>item.id===adjustments.id);
  assert.equal(reloaded.rows[0].overrides[2][10],"0","開始延期の明示0は一次変更後も維持");
  const cleared={...reloaded,fiscalYear:String(plan.fiscalYear),rows:structuredClone(reloaded.rows)};
  delete cleared.rows[0].overrides[2][10];
  edited=await api.updateInitiative(edited,adjustments.id,plan.fiscalYear,cleared);
  reloaded=(await api.readPlanContents(edited)).initiatives.find(item=>item.id===adjustments.id);
  assert.ok(!Object.hasOwn(reloaded.rows[0].overrides[2],10));
  assert.equal(api.initiativesForKind([reloaded],plan.accounts,2)[0].rows[0].amounts[10],"120","解除後は一次へ追従");
  const workbook=await api.serializeWorkbook(api.createReportWorkbook(plan,{tables:["cost-table","expansion-table","initiative-list"],selections:{"cost-table":[1,2],"expansion-table":[1,2],"initiative-list":[1]},costFilter:{industries:null,departments:null}}));
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(workbook);
  assert.ok(reopened.getWorksheet("総原価表")&&reopened.getWorksheet("展開表")&&reopened.getWorksheet("施策一覧")&&reopened.getWorksheet("計算元"));
  const calculation=reopened.getWorksheet("計算元");
  assert.ok(calculation.rowCount>140,"実サンプルの明細を出力");
  assert.deepEqual(bytes,before,"履歴読込・出力で実サンプルを変更しない");
  console.log(`PASS: 新基準サンプル ${bytes.length} bytes、126実務施策、全分類・初期5区分、独立計算した三表/期間計、履歴3時点、Excel出力再読込`);
  console.log("REFERENCE_EXPECTATIONS",JSON.stringify({aprilPrimary:expectations["1/4"],aprilConfirmed:expectations["2/4"],annualPrimarySales:api.initiativeMonths.reduce((sum,m)=>sum+expectations[`1/${m}`].sales,0)}));
}
