import { test, expect, settleMotion } from "./fixtures";

test("アイコンのレールはホバーで展開し、移動後もカーソルを外すと戻る", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const trigger = app.locator(".home-header button");
  const entry = sidebar.getByRole("button", { name: "施策入力", exact: true });
  await settleMotion(app.locator("body"));
  expect((await sidebar.boundingBox())!.width).toBe(64);
  await expect(entry.locator("span")).toHaveCSS("opacity", "0");
  await expect(sidebar.getByRole("navigation").getByRole("button")).toHaveCount(7);
  const icon = (await entry.locator("svg").boundingBox())!;

  await entry.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await settleMotion(app.locator("body"));
  await expect(entry.locator("span")).toHaveCSS("opacity", "1");
  expect((await sidebar.boundingBox())!.width).toBeGreaterThan(64);
  expect(await entry.locator("svg").boundingBox()).toEqual(icon);
  const sideBox = (await sidebar.boundingBox())!;
  const mainBox = (await app.locator(".home-content").boundingBox())!;
  expect(mainBox.x).toBeCloseTo(sideBox.x + sideBox.width);

  await entry.click();
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await app.locator(".home-brand").hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await settleMotion(app.locator("body"));
  expect((await sidebar.boundingBox())!.width).toBe(64);
  expect(await entry.locator("svg").boundingBox()).toEqual(icon);
  await expect(entry).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("button", { name: "ファイルを閉じる", exact: true })).toBeEnabled();
});

test("ボタンで開けば維持し、Esc後は再びホバーで展開できる", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header button");
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  await trigger.click();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.locator(".home-brand").hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await settleMotion(app.locator("body"));

  await sidebar.getByRole("button", { name: "Home", exact: true }).hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await settleMotion(app.locator("body"));
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  // The cursor remains over the rail; explicit collapse must not reopen it.
  expect((await sidebar.boundingBox())!.width).toBe(64);
  await app.locator(".home-brand").hover();
  await sidebar.getByRole("button", { name: "Home", exact: true }).hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await sidebar.getByRole("button", { name: "サイドバーを閉じる", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("キーボードでレールへ入ると項目名が現れ、外へ戻ると折り畳む", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header button");
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  await trigger.focus();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "Home", exact: true })).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(sidebar.getByRole("button", { name: "サイドバーを閉じる", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test.describe("タッチ操作", () => {
  test.use({ hasTouch: true });
  test("レールから直接移動し、ハンバーガーボタンで開閉できる", async ({ app }) => {
    await app.getByRole("button", { name: "ファイルを開く", exact: true }).tap();
    const trigger = app.locator(".home-header button");
    const sidebar = app.getByRole("complementary", { name: "メニュー" });
    await sidebar.getByRole("button", { name: "施策入力", exact: true }).tap();
    await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.tap();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await sidebar.getByRole("button", { name: "Home", exact: true }).tap();
    await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await trigger.tap();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await sidebar.getByRole("button", { name: "ファイルを閉じる", exact: true }).tap();
    await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).tap();
    await expect(app.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
  });
});
