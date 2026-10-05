import type { Page, FrameLocator } from "@playwright/test";
import { test, expect, settleMotion } from "./fixtures";

async function openSample(page: Page, app: FrameLocator) {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
}

test("単年度の全施策と種別を表示し、一覧・展開表の選択だけを復元する", async ({ page, app }) => {
  await openSample(page, app);
  const menu = app.getByRole("complementary", { name: "メニュー" });
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.locator(".initiative-list-table tbody tr")).toHaveCount(13);
  await expect(app.getByRole("combobox", { name: "年度", exact: true })).toHaveCount(0);
  await app.getByRole("group", { name: "表示する種別" }).getByRole("button", { name: "実績", exact: true }).click();
  await menu.getByRole("button", { name: "展開表", exact: true }).click();
  const kinds = app.getByRole("group", { name: "表示する種別" });
  await kinds.getByRole("button", { name: "実績", exact: true }).click();
  await expect(kinds.getByRole("button", { name: "確定予算", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(kinds.getByRole("button", { name: "見通し", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.getByRole("group", { name: "業種", exact: true }).getByRole("button", { name: "直営自動車", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog").getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await menu.getByRole("button", { name: "展開表", exact: true }).click();
  await expect(kinds.getByRole("button", { name: "見通し", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(kinds.getByRole("button", { name: "実績", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.getByRole("group", { name: "業種", exact: true }).getByRole("button", { name: "すべて", exact: true })).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(kinds.getByRole("button", { name: "実績", exact: true })).toHaveAttribute("aria-pressed", "true");
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
