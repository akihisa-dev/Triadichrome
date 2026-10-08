import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withNodeBundle} from './node-bundle.mjs';
import {projectRoot} from './paths.mjs';
// Read-only diagnostic. Times are observations, never machine-dependent test assertions.
await withNodeBundle('tests/performance-api.ts', async api => {
  const bytes = new Uint8Array(await readFile(join(projectRoot,'samples/全機能確認用.triadic')));
  await api.readPlanContents(await api.createTriadicDatabase(2026));
  const timings = {};
  const timed = async (name, operation) => {
    const start = performance.now(); const result = await operation();
    (timings[name] ??= []).push(Math.round(performance.now()-start)); return result;
  };
  let contents; let renderedRows;
  for (let trial=0; trial<3; trial++) {
    contents = await timed('readWithDetails',()=>api.readPlanContents(bytes));
    await timed('readWithoutDetails',()=>api.readPlanContents(bytes,false));
    const html = await timed('renderInitiativeMarkup',()=>api.renderInitiativeList(contents));
    renderedRows = html.split('<tr').length-1;
    await timed('deriveDetails',()=>api.buildDetails(contents));
    await timed('compareWithDetails',()=>JSON.stringify(contents));
    await timed('compareWithoutDetails',()=>JSON.stringify(contents,(key,value)=>key==='details'?undefined:value));
    const item=contents.initiatives[0];
    await timed('updateOneInitiative',()=>api.updateInitiative(bytes,item.id,item.fiscalYear,{...item,fiscalYear:String(item.fiscalYear),note:item.note+' 確認'}));
  }
  console.log(JSON.stringify({bytes:bytes.length,initiatives:contents.initiatives.length,details:contents.details.length,renderedRows,
    milliseconds:Object.fromEntries(Object.entries(timings).map(([name,values])=>[name,{trials:values,median:[...values].sort((a,b)=>a-b)[1]}])),
    note:'画面の描画時間は別途ブラウザで確認してください。ここでのrenderはHTML文字列生成のみです。'},null,2));
});
