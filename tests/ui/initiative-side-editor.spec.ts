import type { Page, FrameLocator } from "@playwright/test";
import { test, expect, settleMotion } from "./fixtures";

async function openList(page: Page, app: FrameLocator) {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション", exact: true }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "季節キャンペーン", exact: true }).click();
}

test("施策名から右パネルで編集し、同じ施策の全画面入力へ移る", async ({ page, app }, testInfo) => {
  await openList(page, app);
  const panel = app.getByRole("complementary", { name: "選択した施策の入力" });
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("季節キャンペーン");
  await panel.getByRole("textbox", { name: "備考", exact: true }).fill("右パネルで更新");
  await panel.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("123.456");
  await expect(panel.getByText("保存済み", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "施策入力を開く" })).toBeEnabled();
  await settleMotion(app.locator("body"));
  await testInfo.attach("右入力パネル", { body: await page.screenshot({ path: `/private/tmp/triadichrome-side-editor-${testInfo.project.name}.png` }), contentType: "image/png" });
  await panel.getByRole("button", { name: "施策入力を開く" }).click();
  await expect(panel).toHaveCount(0);
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("季節キャンペーン");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("右パネルで更新");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true })).toHaveValue("123.456");
  await app.getByRole("button", { name: "← 施策一覧へ戻る" }).click();
  await app.getByRole("button", { name: "保守サービスの新規契約", exact: true }).click();
  await expect(panel.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("保守サービスの新規契約");
  await panel.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(panel).toHaveCount(0);
});

test("右パネルの保存失敗で移動を止め、未保存の入力を保持する", async ({ page, app }) => {
  await openList(page, app);
  await page.getByLabel("ファイル操作").selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション", exact: true }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "季節キャンペーン", exact: true }).click();
  const panel = app.getByRole("complementary", { name: "選択した施策の入力" });
  await panel.getByRole("textbox", { name: "備考", exact: true }).fill("失敗しても保持");
  await expect(panel.getByRole("button", { name: "施策入力を開く" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "閉じる", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "保存を再試行" })).toBeEnabled();
  await expect(panel.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("失敗しても保持");
  await expect(app.getByRole("button", { name: "保守サービスの新規契約", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "未保存の変更を戻す" }).click();
  await expect(panel.getByRole("button", { name: "閉じる", exact: true })).toBeEnabled();
});
