import { test, expect } from "./fixtures";
import type { FrameLocator } from "@playwright/test";

async function master(app: FrameLocator) {
  await app.getByRole("button", {name:"マスタ",exact:true}).click();
  await app.getByRole("button", {name:/^勘定科目マスタ/}).click();
}
async function addAccount(app: FrameLocator,code:string,name:string) {
  await app.getByRole("textbox",{name:"科目コード",exact:true}).fill(code);
  await app.getByRole("textbox",{name:"名称",exact:true}).fill(name);
  await app.getByRole("combobox",{name:"科目属性",exact:true}).selectOption("expense");
  await app.getByRole("button",{name:"登録",exact:true}).click();
  await expect(app.getByRole("button",{name:`${name}を編集`,exact:true})).toBeEnabled();
}

test("科目と集計の所属・加減を同じ列で変更し、循環防止と再読込後の関係を保つ",async({app})=>{
  await app.getByRole("button",{name:"ファイルを開く",exact:true}).click();
  await app.getByRole("button",{name:"サイドバーを開く",exact:true}).click();
  await master(app);
  await addAccount(app,"500","費用科目1");
  await addAccount(app,"600","費用科目2");
  const owner=(name:string)=>app.getByRole("combobox",{name:`${name}の集計`,exact:true});
  const sign=(name:string)=>app.getByRole("combobox",{name:`${name}の加減`,exact:true});
  const move=async(name:string,target:string)=>{
    await owner(name).selectOption({label:target});
    await expect(owner(name)).toBeEnabled();
    await expect(owner(name).locator("option:checked")).toHaveText(target);
  };
  await move("費用科目1","費用集計");await move("費用科目2","費用集計");
  await sign("費用科目2").selectOption("-1");await expect(sign("費用科目2")).toBeEnabled();
  await move("費用集計","営業利益");await sign("費用集計").selectOption("-1");await expect(sign("費用集計")).toBeEnabled();
  for(const name of ["営業利益","費用集計"]) await expect(owner("営業利益").getByRole("option",{name,exact:true})).toBeDisabled();
  await move("費用科目2","売上集計");await move("費用科目2","未所属");await expect(sign("費用科目2")).toBeDisabled();
  await app.getByRole("button",{name:"ファイルを閉じる",exact:true}).click();
  await app.getByRole("alertdialog",{name:"ファイルを閉じる",exact:true}).getByRole("button",{name:"閉じる",exact:true}).click();
  await app.getByRole("button",{name:"ファイルを開く",exact:true}).click();await app.getByRole("button",{name:"サイドバーを開く",exact:true}).click();await master(app);
  await expect(owner("費用集計").locator("option:checked")).toHaveText("営業利益");await expect(sign("費用集計")).toHaveValue("-1");
  await expect(owner("費用科目1").locator("option:checked")).toHaveText("費用集計");await expect(owner("費用科目2")).toHaveValue("");
});

test("集計の登録・表示名編集の保存失敗で入力と必須集計を保持する",async({app,page})=>{
  await page.getByRole("combobox",{name:"ファイル操作",exact:true}).selectOption("save-failure");
  await app.getByRole("button",{name:"ファイルを開く",exact:true}).click();await app.getByRole("button",{name:"サイドバーを開く",exact:true}).click();await master(app);
  await app.getByRole("combobox",{name:"区分",exact:true}).selectOption("group");
  await app.getByRole("textbox",{name:"名称",exact:true}).fill("保存待ち");
  await expect(app.getByRole("textbox",{name:"科目コード",exact:true})).toBeDisabled();
  await expect(app.getByRole("combobox",{name:"科目属性",exact:true})).toBeDisabled();
  await app.getByRole("button",{name:"登録",exact:true}).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");await expect(app.getByRole("textbox",{name:"名称",exact:true})).toHaveValue("保存待ち");
  await expect(app.locator(".account-master-table tbody tr")).toHaveCount(4);
  await app.getByRole("button",{name:"営業利益を編集",exact:true}).press("Enter");
  await expect(app.getByRole("textbox",{name:"営業利益の名称",exact:true})).toHaveCount(0);
  await app.getByRole("textbox",{name:"営業利益の表示名",exact:true}).fill("保存待ち表示");
  await expect(app.getByRole("alert")).toContainText("テスト用の保存失敗です。");await expect(app.getByRole("textbox",{name:"営業利益の表示名",exact:true})).toHaveValue("保存待ち表示");
  await app.getByRole("button",{name:"入力を取り消す",exact:true}).click();await app.getByRole("button",{name:"完了",exact:true}).click();
  await expect(app.getByRole("button",{name:"営業利益を削除",exact:true})).toBeDisabled();
});

test("所属変更の保存失敗では元の所属と並び順を保持する",async({app,page})=>{
  await page.getByRole("combobox",{name:"ファイル操作",exact:true}).selectOption("save-failure");
  await app.getByRole("button",{name:"ファイルを開く",exact:true}).click();await app.getByRole("button",{name:"サイドバーを開く",exact:true}).click();await master(app);
  const table=app.getByRole("table",{name:"科目・集計一覧",exact:true});
  await expect(table.getByRole("rowheader")).toHaveCount(4);
  const before=await table.getByRole("rowheader").allTextContents();
  const owner=app.getByRole("combobox",{name:"売上集計の集計",exact:true});await owner.selectOption({label:"営業利益"});
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");await expect(owner).toHaveValue("");await expect(owner).toBeEnabled();
  await expect(app.getByRole("combobox",{name:"売上集計の加減",exact:true})).toBeDisabled();await expect(table.getByRole("rowheader")).toHaveText(before);
});
