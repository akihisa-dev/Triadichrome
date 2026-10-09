import { withNodeBundle } from './node-bundle.mjs';
await withNodeBundle('tests/core-api.ts', async api => {
 const base = await api.readPlanContents(await api.createSamplePlan(2026));
 for (const count of [100, 500, 1000]) for (const distributed of [false, true]) {
  const plan = { ...base, initiatives: Array.from({length: count}, (_, i) => ({...base.initiatives[0], id: i + 1, name: `施策${i}`, expansionId: distributed ? base.expansions[i % base.expansions.length].id : base.expansions[0].id})) };
  const measurements = [];
  for (let trial=0;trial<3;trial++) {global.gc?.(); const heap=process.memoryUsage().heapUsed, start=performance.now(); const table=api.buildKindExpansionTable(plan,[1,2],'registered'); measurements.push({ms:+(performance.now()-start).toFixed(2), heapMiB:+((process.memoryUsage().heapUsed-heap)/1048576).toFixed(2), rows:table.groups.reduce((n,g)=>n+g.initiatives.length,0)});}
  console.log(JSON.stringify({count,distributed,measurements,note:'Node内の表示計算のみ。ブラウザ描画は別測定。メモリは一時割当を含む。'}));
 }
});
