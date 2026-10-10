import {test, expect} from './fixtures';

test('基準サンプルの全件・末尾・三表・編集と取消を確認する', async ({page,app}) => {
  test.setTimeout(120_000);
  await page.getByLabel('テストデータ').selectOption('large');
  await expect(page.getByRole('status')).toHaveText('操作できます');
  await app.getByRole('button',{name:'ファイルを開く',exact:true}).click();
  const nav=app.getByRole('navigation',{name:'メインナビゲーション'});
  await expect(nav).toBeAttached();
  const navigate=async(name:string)=>{
    await app.getByRole('button',{name:'サイドバーを開く',exact:true}).click();
    await nav.getByRole('button',{name,exact:true}).click();
    await app.getByRole('button',{name:'サイドバーを閉じる',exact:true}).last().click();
    await expect(app.getByRole('heading',{name,exact:true})).toBeVisible();
  };
  await navigate('施策一覧');
  const list=app.locator('.initiative-list-table');
  await expect(list).toHaveAttribute('aria-rowcount','143');
  expect(await list.locator('tbody tr:not(.virtual-row-spacer)').count()).toBeLessThanOrEqual(140);
  const total=await list.locator('tfoot').textContent();
  await app.locator('.initiative-list-container').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(list.getByRole('button',{name:'保有資産・担当業務の移管・西',exact:true})).toBeAttached();
  expect(await list.locator('tbody tr:not(.virtual-row-spacer)').count()).toBeLessThanOrEqual(140);
  expect(await list.locator('tfoot').textContent()).toBe(total);
  await navigate('展開表');
  const expansion=app.locator('.expansion-table-page .initiative-list-table');
  expect(await expansion.locator('tbody tr:not(.virtual-row-spacer)').count()).toBe(147);
  await app.locator('.expansion-table-page .initiative-list-container').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect(expansion.locator('.expansion-subtotal-name').last()).toContainText('計');
  await expect(nav.getByRole('button',{name:'明細',exact:true})).toHaveCount(0);
  await navigate('総原価表');
  await expect(app.getByRole('heading',{name:'総原価表',exact:true})).toBeVisible();
  await navigate('施策一覧');
  await app.locator('.initiative-list-container').evaluate(el=>{el.scrollTop=0;});
  await list.getByRole('button',{name:'既存商品の販売拡大',exact:true}).click();
  await app.getByRole('tab',{name:'一次予算',exact:true}).click();
  const amount=app.getByRole('spinbutton',{name:'売上高 4月の金額',exact:true}).first();
  await expect(amount).toHaveValue('120');
  await amount.fill('130');
  await amount.press('Tab');
  await expect(app.getByRole('button',{name:'操作を取り消す',exact:true})).toBeEnabled({timeout:60_000});
  await app.getByRole('button',{name:'操作を取り消す',exact:true}).click();
  await expect(amount).toHaveValue('120',{timeout:60_000});
  await expect(app.getByRole('button',{name:'操作をやり直す',exact:true})).toBeEnabled();
  await app.getByRole('button',{name:'操作をやり直す',exact:true}).click();
  await expect(amount).toHaveValue('130',{timeout:60_000});
  await app.getByRole('button',{name:'操作を取り消す',exact:true}).click();
  await expect(amount).toHaveValue('120',{timeout:60_000});
});

test('基準サンプルの費用UP5区分は目的・科目・確定改定に一致する', async ({page,app}) => {
  test.setTimeout(120_000);
  await page.getByLabel('テストデータ').selectOption('large');
  await expect(page.getByRole('status')).toHaveText('操作できます');
  await app.getByRole('button',{name:'ファイルを開く',exact:true}).click();
  await app.getByRole('button',{name:'サイドバーを開く',exact:true}).click();
  await app.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('button',{name:'施策一覧',exact:true}).click();
  await app.getByRole('button',{name:'サイドバーを閉じる',exact:true}).last().click();
  const cases = [
    {name:'車両整備・委託作業単価の上昇・東',category:'下払いUP',account:'下払作業賃',month:7,primary:'12',confirmed:'13.5',reason:'委託先合意'},
    {name:'車両整備・給与ベースアップ・西',category:'ベースアップ',account:'給料手当',month:7,primary:'15',confirmed:'17.5',reason:'労使合意'},
    {name:'法人車両・洗車設備の更新・東',category:'設備投資',account:'固定資産減価償却費',month:10,primary:'22',confirmed:'0',reason:'納期が11月'},
    {name:'法人車両・燃料単価の上昇・西',category:'燃料費UP',account:'燃料油脂費',month:10,primary:'5.25',confirmed:'6.3',reason:'仕入先通知'},
    {name:'月極賃貸・電気契約料金の上昇・東',category:'電気料金UP',account:'動力光熱費',month:7,primary:'4.5',confirmed:'0',reason:'契約更新が9月'},
  ];
  for(const item of cases) {
    await app.getByRole('button',{name:item.name,exact:true}).click();
    await expect(app.getByRole('combobox',{name:'展開区分',exact:true}).locator('option:checked')).toHaveText(item.category);
    await expect(app.getByRole('textbox',{name:'備考',exact:true})).toHaveValue(new RegExp(item.reason));
    await app.getByRole('tab',{name:'一次予算',exact:true}).click();
    const amount=app.getByRole('spinbutton',{name:`${item.account} ${item.month}月の金額`,exact:true});
    await expect(amount).toHaveValue(item.primary);
    await app.getByRole('tab',{name:'確定予算',exact:true}).click();
    await expect(amount).toHaveValue(item.confirmed);
    await app.getByRole('button',{name:'← 施策一覧へ戻る',exact:true}).click();
  }
});
