import { test, expect } from '@playwright/test';
test('大量行でも非操作行の候補を省き、クリック・キー・IDの選択と入力を保つ',async({page,context})=>{
 await page.goto('/tests/ui/performance-preview.html?mode=initiative&count=600&sameNames=1');
 const first=page.getByRole('combobox',{name:'1行目の勘定科目',exact:true});
 await expect(first).toHaveValue('1');
 await expect(page.locator('select')).toHaveCount(200);
 await expect(page.locator('option')).toHaveCount(400);
 await first.click(); // Native dropdown must already contain the complete choices on the first click.
 await expect(first.locator('option')).toHaveCount(601);
 await first.press('Escape');
 const native = await context.newPage();
 await native.setContent('<select aria-label="標準"><option value="">科目を選択</option><option value="1">001 同名科目</option><option value="2">002 同名科目</option></select>');
 const reference = native.getByRole('combobox', {name:'標準'});
 await reference.selectOption('1'); await reference.focus();
 await first.selectOption('1'); await first.focus();
 for (const key of ['ArrowDown', 'ArrowDown', 'Enter']) { await reference.press(key); await first.press(key); }
 await expect(first).toHaveValue(await reference.inputValue());
 await native.close();
 await first.selectOption('2'); await expect(first).toHaveValue('2'); // Same display name, distinct account IDs and codes.
 await first.selectOption('600'); await first.press('Tab');
 await expect(first).toHaveValue('600'); await expect(page.locator('option')).toHaveCount(400);
 const cell=page.locator('input[data-row="0"][data-column="0"]');
 await cell.fill('0.001'); await expect(cell).toHaveValue('0.001'); await expect(first).toBeDisabled();
 await cell.press('Escape'); await expect(cell).toHaveValue('0'); await expect(first).toBeEnabled();
 const second=page.getByRole('combobox',{name:'2行目の勘定科目',exact:true});
 await second.focus(); await expect(second.locator('option')).toHaveCount(601);
 await second.selectOption('1'); await expect(second).toHaveValue('1');
 await cell.focus(); await expect(page.locator('option')).toHaveCount(400);
});
