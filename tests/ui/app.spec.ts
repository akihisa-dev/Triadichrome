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
  const trigger = app.getByRole("button", { name: "サイドバーを開く" });
  const dialog = app.getByRole("dialog", { name: "メニュー" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
  await attachImage(testInfo, "ホーム", await preview.screenshot());

  await trigger.click();
  const close = dialog.getByRole("button", { name: "サイドバーを閉じる" });
  await expect(close).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await attachImage(testInfo, "サイドバー", await preview.screenshot());
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.click({ position: { x: (await dialog.boundingBox())!.width - 8, y: 200 } });
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await dialog.getByRole("button", { name: "Home", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();

  await trigger.click();
  await dialog.getByRole("button", { name: "ファイルを閉じる" }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(dialog).not.toBeVisible();
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
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
