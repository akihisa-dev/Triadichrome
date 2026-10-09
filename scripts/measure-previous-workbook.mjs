import { withNodeBundle } from './node-bundle.mjs';
// Diagnostic only: timings and heap deltas are observations, never test thresholds.
await withNodeBundle('tests/core-api.ts', async api => {
  const source = await api.readPlanContents(await api.createSamplePlan(2026));
  for (const count of [100, 300, 600]) {
    const accounts = Array.from({ length: count }, (_, i) => ({ ...source.accounts[0], id: i + 1, accountCode: String(i + 1).padStart(3, '0'), accountName: `科目${i}` }));
    const pairs = source.departments.map(d => ({ industryId: source.industries[0].id, departmentId: d.id }));
    const previousAmounts = pairs.flatMap(pair => accounts.flatMap(account => api.initiativeMonths.map(month => ({ ...pair, accountId: account.id, month, amount: '1.125', id: 1, revision: 0 }))));
    const plan = { ...source, accounts, previousAmounts };
    const measurements = [];
    for (let trial = 0; trial < 3; trial++) {
      global.gc?.(); const heap = process.memoryUsage().heapUsed, start = performance.now();
      const wb = api.createPreviousWorkbook(plan, pairs), built = performance.now();
      const patches = api.readPreviousWorkbook(wb, plan), end = performance.now();
      measurements.push({ outputMs: +(built - start).toFixed(2), inputMs: +(end - built).toFixed(2), heapMiB: +((process.memoryUsage().heapUsed - heap) / 1048576).toFixed(2), patches: patches.length });
    }
    console.log(JSON.stringify({ accounts: count, records: previousAmounts.length, measurements, note: '同じNode環境でExcelJSモデル構築・内容検証を測定。圧縮・解析と画面描画は含まない。heapは保持量と一時割当を含む。' }));
  }
});
