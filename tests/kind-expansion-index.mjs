import assert from 'node:assert/strict';
export function verifyKindExpansionIndex(api, contents) {
 const original = (plan, selected, sort) => {
  const projections=selected.map(kind=>api.initiativesForKind(plan.initiatives,plan.accounts,kind));
  const table=api.buildExpansionTable({...plan,initiatives:projections[0]},plan.fiscalYear,sort), prior=api.previousTotals(plan);
  const compare=values=>selected.length===2?[...values,api.combineTotals(values[selected.indexOf(2)],values[selected.indexOf(1)],-1)]:values;
  const totals=projections.map(api.totalInitiatives);
  return {previous:compare(selected.map(()=>prior)),total:compare(totals.map(total=>api.combineTotals(prior,total))),changes:compare(totals),groups:table.groups.map(group=>{
   const members=projections.map(items=>items.filter(item=>item.expansionId===group.expansion.id));
   return {...group,values:compare(members.map(api.totalInitiatives)),initiatives:group.initiatives.map(item=>({...item,values:compare(members.map(items=>items.find(next=>next.id===item.id).months))}))};
  })};
 };
 const plan={...contents,initiatives:contents.initiatives.map((item,i)=>({...item,name:'同名の施策',expansionId:contents.expansions[i%contents.expansions.length].id}))};
 for (const selected of [[1],[2],[1,2],[2,1]]) for (const sort of ['registered','asc','desc']) {
  assert.deepEqual(api.buildKindExpansionTable(plan,selected,sort),original(plan,selected,sort),'同名でも施策IDで種別金額を対応させ、順序・比較・前年・未設定を維持');
 }
}
