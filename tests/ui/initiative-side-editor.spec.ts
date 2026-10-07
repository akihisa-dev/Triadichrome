import type { Page, FrameLocator } from "@playwright/test";
import { test, expect, settleMotion } from "./fixtures";

async function openList(page: Page, app: FrameLocator, scenario = "success") {
  await page.goto("/tests/ui/preview.html");
  if (scenario !== "success") await page.getByLabel("ファイル操作").selectOption(scenario);
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション", exact: true }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "季節キャンペーン", exact: true }).click();
}

test("施策名から全画面入力を直接開き、自動保存後に一覧から開き直す", async ({ page, app }, testInfo) => {
  await openList(page, app);
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toHaveCount(0);
  await expect(app.getByRole("complementary", { name: "選択した施策の入力" })).toHaveCount(0);
  await expect(app.getByRole("button", { name: "施策入力を開く" })).toHaveCount(0);
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("季節キャンペーン");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("全画面で更新");
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("123.456");
  const back = app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true });
  await expect(back).toBeEnabled();
  await expect(app.getByText("保存済み", { exact: true })).toBeVisible();
  await settleMotion(app.locator("body"));
  await testInfo.attach("一覧から直接開いた施策入力", { body: await page.screenshot(), contentType: "image/png" });
  await back.click();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "季節キャンペーン", exact: true }).click();
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("全画面で更新");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true })).toHaveValue("123.456");
  await back.click();
  await app.getByRole("button", { name: "保守サービスの新規契約", exact: true }).click();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("保守サービスの新規契約");
});

test("全画面入力の保存失敗で移動を止め、未保存の入力を保持する", async ({ page, app }) => {
  await openList(page, app, "save-failure");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("失敗しても保持");
  const back = app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true });
  await expect(app.getByRole("alert")).toContainText("自動保存できませんでした");
  await expect(back).toBeDisabled();
  await expect(app.getByRole("button", { name: "前の画面に戻る", exact: true })).toBeDisabled();
  await expect(app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true })).toBeDisabled();
  await expect(app.getByRole("button", { name: "保存を再試行" })).toBeEnabled();
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("失敗しても保持");
  await app.getByRole("button", { name: "未保存の変更を戻す" }).click();
  await expect(back).toBeEnabled();
  await back.click();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
});
