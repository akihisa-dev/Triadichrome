import { withNodeBundle } from './node-bundle.mjs';
await withNodeBundle('tests/core-api.ts', async api => {
 const base = await api.readPlanContents(await api.createSamplePlan(2026));
 for (const count of [100,300,600]) {
  const accounts = Array.from({length: count}, (_,i) => ({...base.accounts[0], id:i+1, accountName:`科目${i}`}));
  const contents = {...base, accounts, previousAmounts:accounts.flatMap(a=>api.initiativeMonths.map(month=>({industryId:1,departmentId:1,accountId:a.id,month,amount:'0',id:1,revision:0})))};
  const previous = new Map(accounts.map(a=>[a.id,Object.fromEntries(api.initiativeMonths.map(m=>[m,0]))]));
  const trials=[];
  for(let n=0;n<3;n++) {
   global.gc?.(); const heap=process.memoryUsage().heapUsed,start=performance.now();
   api.buildCostTable(accounts,contents.aggregations,[],2026,previous); const calculated=performance.now();
   if(api.createPreviousInput) api.createPreviousInput(contents,1,1);
   else accounts.map(a=>({accountId:a.id,amounts:Object.fromEntries(api.initiativeMonths.map(month=>[month,contents.previousAmounts.find(p=>p.industryId===1&&p.departmentId===1&&p.accountId===a.id&&p.month===month)?.amount ?? '0']))}));
   trials.push({calculationMs:+(calculated-start).toFixed(2),initialDraftMs:+(performance.now()-calculated).toFixed(2),heapMiB:+((process.memoryUsage().heapUsed-heap)/1048576).toFixed(2)});
  }
  console.log(JSON.stringify({count,trials,note:'Node集計計算と編集下書き初期化のみ。ブラウザ描画は別測定。'}));
 }
});
