import { test, expect } from './fixtures';
for (const dataset of ['defaults', 'large']) test(`加減計測 ${dataset}`, async({app,page})=>{
  test.setTimeout(120000);
  await page.getByRole('combobox',{name:'テストデータ',exact:true}).selectOption(dataset);
  await expect(page.getByRole('status')).toHaveText('操作できます');
  await app.getByRole('button',{name:'ファイルを開く',exact:true}).click();
  await app.getByRole('button',{name:'マスタ',exact:true}).click();
  await app.getByRole('button',{name:/^勘定科目マスタ /}).click();
  const group=app.getByRole('group',{name:'売上高の加減',exact:true});
  const minus=group.getByRole('button',{name:'減算',exact:true});
  await expect(minus).toBeEnabled();
  const start=Date.now();await minus.click();await expect(minus).toHaveAttribute('aria-pressed','true',{timeout:1000});
  const feedback=Date.now()-start;
  expect(feedback).toBeLessThan(1000);
  await expect(minus).toBeEnabled({timeout:30000});
  console.log(`SIGN_PERF ${dataset} feedback ${feedback}ms saved ${Date.now()-start}ms`);
});
