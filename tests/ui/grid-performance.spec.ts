import { test, expect } from '@playwright/test';
// Explicit diagnostic: use PERF_MODE; no machine-dependent duration assertions.
const mode = process.env.PERF_MODE ?? 'expansion';
test('合成データの描画・入力・DOM・メモリの観測', async ({page}, info) => {
 test.skip(info.project.name !== 'desktop' || !process.env.PERF_MODE);
 test.setTimeout(120000);
 for (const count of (mode === 'expansion' ? [100,500,1000] : [100,300,600])) {
  for (let trial=0; trial<3; trial++) {
   await page.goto(`/tests/ui/performance-preview.html?mode=${mode}&count=${count}`);
   await expect(page.getByRole('table')).toBeVisible();
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   const initial = await page.evaluate(()=>({metrics:(window as unknown as {gridMeasurements:unknown[]}).gridMeasurements.slice(),nodes:document.querySelectorAll('*').length,options:document.querySelectorAll('option').length,heap:(performance as unknown as {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize}));
   let update = null;
   if (mode !== 'expansion') {
    const cell=page.locator('input[data-row="0"][data-column="0"]');
    await cell.focus();
    const commits = await page.evaluate(()=>(window as unknown as {gridMeasurements:unknown[]}).gridMeasurements.length);
    const started=performance.now(); await cell.fill('1.125');
    await expect(cell).toHaveValue('1.125');
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    update={elapsedMs:performance.now()-started, ...await page.evaluate(n=>({metrics:(window as unknown as {gridMeasurements:unknown[]}).gridMeasurements.slice(n),heap:(performance as unknown as {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize}),commits)};
   }
   console.log(JSON.stringify({mode,count,trial,initial,update,note:'Chrome開発ビルド。ProfilerはReact処理のみ、入力時間は操作APIと次の描画待ちを含む。heapはGC時点に依存。'}));
  }
 }
});
