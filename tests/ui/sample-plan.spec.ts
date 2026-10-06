import type { Page, FrameLocator } from "@playwright/test";
import { test, expect, settleMotion } from "./fixtures";

async function openSample(page: Page, app: FrameLocator) {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
}

test("4表の上部にスライサーがなく、全分類と保存済み種別を表示する", async ({ page, app }) => {
  await openSample(page, app);
  const menu = app.getByRole("complementary", { name: "メニュー" });
  for (const screen of ["施策一覧", "総原価表", "展開表", "明細"]) {
    await menu.getByRole("button", { name: screen, exact: true }).click();
    await expect(app.getByRole("heading", { name: screen, exact: true })).toBeVisible();
    for (const name of ["表示する種別", "業種", "部署"]) {
      await expect(app.getByRole("group", { name, exact: true })).toHaveCount(0);
    }
    await expect(app.locator(".plan-slicers")).toHaveCount(0);
    if (screen === "施策一覧") {
      await expect(app.locator(".initiative-list-table tbody tr")).toHaveCount(13);
    }
    if (screen === "総原価表" || screen === "展開表") {
      await expect(app.getByRole("table").getByRole("columnheader").filter({ hasText: "確定予算" }).first()).toBeVisible();
      await expect(app.getByRole("table").getByRole("columnheader").filter({ hasText: "見通し" }).first()).toBeVisible();
    }
    if (screen === "明細") {
      await expect(app.getByRole("table").getByRole("columnheader", { name: /種別/ })).toBeVisible();
    }
  }
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog").getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.locator(".initiative-list-table tbody tr")).toHaveCount(13);
  await expect(app.locator(".plan-slicers")).toHaveCount(0);
});

test("月別引き継ぎ・手修正0・解除・修正開始と取消・前年入力を操作できる", async ({ page, app }, testInfo) => {
  await openSample(page, app);
  const menu = app.getByRole("complementary", { name: "メニュー" });
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "修正予算の入力準備", exact: true }).click();
  const april = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  await april.fill("120");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(april).toHaveValue("120");
  await april.fill("0");
  const reset = app.getByRole("button", { name: "売上高 4月を引き継ぎに戻す", exact: true });
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(april).toHaveValue("120");
  await app.getByRole("tab", { name: "修正予算", exact: true }).click();
  await expect(april).toBeDisabled();
  await expect(app.getByRole("spinbutton", { name: "売上高 10月の金額", exact: true })).toHaveValue("150");
  await app.getByRole("tab", { name: "見通し", exact: true }).click();
  const october = app.getByRole("spinbutton", { name: "売上高 10月の金額", exact: true });
  await expect(october).toHaveValue("100");
  await app.getByRole("button", { name: "修正予算を開始", exact: true }).click();
  await expect(october).toHaveValue("150");
  await app.getByRole("button", { name: "確定予算を使う状態に戻す", exact: true }).click();
  await expect(october).toHaveValue("100");
  await menu.getByRole("button", { name: "前年入力", exact: true }).click();
  await app.getByRole("combobox", { name: "業種名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "部署名", exact: true }).selectOption("1");
  const previous = app.getByRole("spinbutton", { name: "売上高 4月の前年金額", exact: true });
  await previous.fill("1001");
  await expect(app.getByRole("combobox", { name: "部署名", exact: true })).toBeEnabled();
  await menu.getByRole("button", { name: "前年入力", exact: true }).click();
  await expect(previous).toHaveValue("1001");
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: `/private/tmp/triadichrome-single-year-${testInfo.project.name}.png` });
});
