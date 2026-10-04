import { test as base, expect, type FrameLocator, type TestInfo } from "@playwright/test";
import { installMemoryFiles } from "./memory-files";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const test = base.extend<{ app: FrameLocator }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto("/tests/ui/preview.html");
    await expect(page).toHaveTitle("Triadichrome 画面テスト");
    await expect(page.getByRole("status")).toHaveText("操作できます");
    const app = page.frameLocator("#app-preview");
    await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
    await use(app);
    await expect(app.locator("vite-error-overlay")).toHaveCount(0);
    expect(errors, "画面の実行時エラー・警告").toEqual([]);
  },
});

async function attachImage(testInfo: TestInfo, name: string, image: Buffer) {
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}

test("ファイルを開き、サイドバーを操作して入口へ戻る", async ({ page, app }, testInfo) => {
  const preview = page.locator("#app-preview");
  await attachImage(testInfo, "入口", await preview.screenshot());
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button");
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const main = app.getByRole("main", { name: "ホーム", exact: true });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
  const fullMain = (await main.boundingBox())!;
  await attachImage(testInfo, "ホーム", await preview.screenshot());

  await trigger.click();
  const close = sidebar.getByRole("button", { name: "サイドバーを閉じる" });
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleName("サイドバーを閉じる");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  const sidebarBox = (await sidebar.boundingBox())!;
  const mainBox = (await main.boundingBox())!;
  expect(mainBox.x).toBeCloseTo(sidebarBox.x + sidebarBox.width);
  expect(mainBox.width).toBeCloseTo(fullMain.width - sidebarBox.width);
  expect(mainBox.width).toBeGreaterThan(0);
  expect(mainBox.y).toBe(fullMain.y);
  await expect(app.getByRole("dialog")).toHaveCount(0);
  await attachImage(testInfo, "サイドバー", await preview.screenshot());
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAccessibleName("サイドバーを開く");
  expect(await main.boundingBox()).toEqual(fullMain);
  await expect(app.getByRole("navigation")).toHaveCount(0);

  await trigger.click();
  await close.click();
  await expect(sidebar).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await main.click({ position: { x: 20, y: 20 } });
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await trigger.click();
  await expect(sidebar).not.toBeVisible();
  expect(await main.boundingBox()).toEqual(fullMain);

  await trigger.click();
  await sidebar.getByRole("button", { name: "ファイルを閉じる" }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).not.toBeVisible();
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("サイドバーを開いたまま施策入力とホームを往復できる", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button");
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const navigation = sidebar.getByRole("navigation", { name: "メインナビゲーション" });
  const home = navigation.getByRole("button", { name: "Home", exact: true });
  const initiativeEntry = navigation.getByRole("button", { name: "施策入力", exact: true });

  await trigger.click();
  await expect(navigation.getByRole("button")).toHaveText(["Home", "施策入力"]);
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(initiativeEntry).not.toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "サイドバーを閉じる" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(home).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(initiativeEntry).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(sidebar).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(initiativeEntry).toBeFocused();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toHaveCount(0);
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);

  await expect(initiativeEntry).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current", "page");
  await app.getByRole("heading", { name: "施策入力", exact: true }).click();
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await trigger.click();
  await home.click();
  await expect(sidebar).toBeVisible();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toHaveCount(0);

  await expect(home).toHaveAttribute("aria-current", "page");
  await initiativeEntry.click();
  await sidebar.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  await expect(sidebar).not.toBeVisible();
});

test("画面幅を変えてもサイドバーとメインが並び、閉じると幅が戻る", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button");
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  await trigger.click();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();

  for (const width of [320, 600, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(sidebar).toBeVisible();
    const frame = (await page.locator("#app-preview").boundingBox())!;
    const sidebarBox = (await sidebar.boundingBox())!;
    const mainBox = (await app.getByRole("main", { name: "施策入力", exact: true }).boundingBox())!;
    expect(sidebarBox.x).toBe(frame.x);
    expect(mainBox.x).toBeCloseTo(sidebarBox.x + sidebarBox.width);
    expect(mainBox.x + mainBox.width).toBeCloseTo(frame.x + frame.width);
    expect(mainBox.width).toBeGreaterThanOrEqual(frame.width / 2);
    expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await app.getByRole("heading", { name: "施策入力", exact: true }).click();
    await expect(sidebar).toBeVisible();
  }

  await trigger.click();
  await expect(sidebar).not.toBeVisible();
  const mainBox = (await app.getByRole("main", { name: "施策入力", exact: true }).boundingBox())!;
  const frame = (await page.locator("#app-preview").boundingBox())!;
  expect(mainBox.x).toBe(frame.x);
  expect(mainBox.width).toBe(frame.width);
});

test("新しい計画をメモリ上に作成し、閉じた後に読み直せる", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.locator(".home-file-name")).toHaveText("Untitled.triadic");
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "ファイルを閉じる" }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.locator(".home-file-name")).toHaveText("Untitled.triadic");
});

test("選択・新規作成のキャンセル後も入口を操作できる", async ({ page, app }) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("cancel");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  for (const name of ["ファイルを開く", "新規作成"]) {
    await app.getByRole("button", { name, exact: true }).click();
    await expect(app.getByRole("button", { name, exact: true })).toBeEnabled();
    await expect(app.getByRole("alert")).toHaveCount(0);
    await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  }
});

test("壊れたファイルを拒否し、正常なファイルで再開できる", async ({ page, app }, testInfo) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("invalid");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("Triadicファイルを読み込めませんでした。");
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await attachImage(testInfo, "不正ファイル", await page.locator("#app-preview").screenshot());
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("normal");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
});

test("保存失敗時は入口に残り、既存の計画を開ける", async ({ page, app }) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
});

test("確認用画面と配布用ビルドの表示・操作が一致する", async ({ page, app, context }, testInfo) => {
  const production = await context.newPage();
  const errors: string[] = [];
  production.on("pageerror", error => errors.push(error.message));
  production.on("console", message => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  try {
    const bounds = (await page.locator("#app-preview").boundingBox())!;
    await production.setViewportSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
    const bytes = await page.evaluate(async path => (await import(path)).fixtureBytes as number[], "/tests/ui/preview.ts");
    await production.goto("/Triadichrome-extension/index.html");
    await production.evaluate(installMemoryFiles, { bytes, scenario: "normal" as const });
    await expect(production).toHaveTitle("Triadichrome");
    await expect(production.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
    for (const state of ["入口", "ホーム", "サイドバー"] as const) {
      if (state !== "入口") {
        const name = state === "ホーム" ? "ファイルを開く" : "サイドバーを開く";
        await app.getByRole("button", { name, exact: true }).click();
        await production.getByRole("button", { name, exact: true }).click();
      }
      if (state === "ホーム") {
        await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
        await expect(production.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
      }
      await expect(app.locator("img")).toHaveCount(1);
      await expect.poll(() => app.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      await expect.poll(() => production.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      expect(await app.locator("body").ariaSnapshot()).toBe(await production.locator("body").ariaSnapshot());
      const previewImage = await page.locator("#app-preview").screenshot({ animations: "disabled" });
      const productionImage = await production.screenshot({ animations: "disabled" });
      await attachImage(testInfo, `${state}・確認用`, previewImage);
      await attachImage(testInfo, `${state}・配布用`, productionImage);
      const reference = PNG.sync.read(previewImage);
      const actual = PNG.sync.read(productionImage);
      expect({ width: actual.width, height: actual.height }).toEqual({ width: reference.width, height: reference.height });
      const difference = new PNG({ width: reference.width, height: reference.height });
      // Nested and top-level pages can rasterize text edges differently. Ignore
      // anti-aliasing and small color differences; require zero other differences.
      const differentPixels = pixelmatch(reference.data, actual.data, difference.data, reference.width, reference.height, { threshold: 0.1 });
      if (differentPixels > 0) await attachImage(testInfo, `${state}・差分`, PNG.sync.write(difference));
      expect(differentPixels, `${state}の表示が配布用ビルドと一致する`).toBe(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await production.close();
  }
});
