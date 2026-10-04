import { test as base, expect, type FrameLocator, type Locator, type TestInfo } from "@playwright/test";

// Wait for actual completion, including a second fade started by transitionend.
// Do not disable motion or assume that a fixed delay is long enough.
export async function settleMotion(element: Locator) {
  await element.evaluate(async node => {
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    for (;;) {
      await frame();
      await frame();
      const animations = node.getAnimations({ subtree: true }).filter(animation => animation.playState !== "finished");
      if (animations.length === 0) return;
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    }
  });
}

export const test = base.extend<{ app: FrameLocator }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto("/tests/ui/preview.html?data=empty");
    await expect(page).toHaveTitle("Triadichrome 画面テスト");
    await expect(page.getByRole("status")).toHaveText("操作できます");
    const app = page.frameLocator("#app-preview");
    await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
    await settleMotion(app.locator("body"));
    await use(app);
    await expect(app.locator("vite-error-overlay")).toHaveCount(0);
    expect(errors, "画面の実行時エラー・警告").toEqual([]);
  },
});

export { expect };

export async function attachImage(testInfo: TestInfo, name: string, image: Buffer) {
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}
