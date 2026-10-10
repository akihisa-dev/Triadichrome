import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { markupCells, workbookCells } from '../report-parity.mjs';
import { test, expect } from './fixtures';

test('ダウンロードした三表とブラウザで表示する三表の全セル・結合が一致する', async ({ page, app }) => {
  await page.goto('/tests/ui/preview.html');
  await expect(page.getByRole('status')).toHaveText('操作できます');
  await app.getByRole('button', { name: 'ファイルを開く', exact: true }).click();
  await app.getByRole('button', { name: 'サイドバーを開く', exact: true }).click();
  const navigate = (name: string) => app.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('button', { name, exact: true }).click();
  await navigate('入出力');
  const pending = page.waitForEvent('download');
  await app.getByRole('button', { name: '選んだ表を出力', exact: true }).click();
  const file = await pending;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await readFile((await file.path())!) as unknown as ExcelJS.Buffer);
  for (const name of ['総原価表', '施策一覧', '展開表']) {
    await navigate(name);
    const table = app.getByRole('table', { name, exact: true });
    await expect(table).toBeVisible();
    const markup = await table.evaluate(node => node.outerHTML);
    expect(workbookCells(wb.getWorksheet(name)!)).toEqual(markupCells(markup));
  }
});
