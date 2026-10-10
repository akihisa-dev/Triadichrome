import { test, expect, settleMotion } from "./fixtures";
import type { FrameLocator, Page, Locator } from "@playwright/test";

async function openMaster(app: FrameLocator, page: Page) {
  await page.getByRole("combobox", { name: "テストデータ", exact: true }).selectOption("defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
}

async function aligned(group: Locator) {
  await settleMotion(group);
  const boxes = await group.evaluate(element => {
    const active = element.querySelector('button[aria-pressed="true"]')!.getBoundingClientRect();
    const pill = element.querySelector(".pill")!.getBoundingClientRect();
    return { left: pill.left - active.left, width: pill.width - active.width };
  });
  expect(boxes.left).toBeCloseTo(0, 0);expect(boxes.width).toBeCloseTo(0, 0);
}

test("加減のボタンと左右キーで選択を保存し、背景が選択側に揃う", async ({app,page}) => {
  await openMaster(app,page);
  const group=app.getByRole("group",{name:"売上高の加減",exact:true});
  const plus=group.getByRole("button",{name:"加算",exact:true}), minus=group.getByRole("button",{name:"減算",exact:true});
  await expect(plus).toHaveAttribute("aria-pressed","true");await aligned(group);
  await minus.click();await expect(minus).toHaveAttribute("aria-pressed","true");await expect(minus).toBeEnabled();await aligned(group);
  await minus.press("ArrowLeft");await expect(plus).toHaveAttribute("aria-pressed","true");await expect(plus).toBeFocused();await expect(plus).toBeEnabled();await aligned(group);
  await page.emulateMedia({reducedMotion:"reduce"});
  await plus.press("ArrowRight");await expect(minus).toHaveAttribute("aria-pressed","true");await expect(minus).toBeEnabled();await aligned(group);
  await app.getByRole("button",{name:"ファイルを閉じる",exact:true}).click();
  await app.getByRole("alertdialog",{name:"ファイルを閉じる",exact:true}).getByRole("button",{name:"閉じる",exact:true}).click();
  await app.getByRole("button",{name:"ファイルを開く",exact:true}).click();await app.getByRole("button",{name:"マスタ",exact:true}).click();await app.getByRole("button",{name:/^勘定科目マスタ/}).click();
  await expect(minus).toHaveAttribute("aria-pressed","true");await aligned(group);
});

test("加減の保存失敗では選択と背景を元の符号に保つ", async ({app,page}) => {
  await page.getByRole("combobox",{name:"ファイル操作",exact:true}).selectOption("save-failure");
  await openMaster(app,page);
  const group=app.getByRole("group",{name:"売上高の加減",exact:true});
  await group.getByRole("button",{name:"減算",exact:true}).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");
  await expect(group.getByRole("button",{name:"加算",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(group.getByRole("button",{name:"減算",exact:true})).toHaveAttribute("aria-pressed","false");await aligned(group);
});
