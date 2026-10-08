import { test as base, expect, type FrameLocator, type Page, type Locator, type TestInfo } from "@playwright/test";

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
  app: async ({ page }, use, testInfo) => {
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
    const expected = testInfo.annotations.filter(item => item.type === "expected-console").map(item => item.description);
    for (const message of expected) expect(errors).toContain(message);
    expect(errors.filter(message => !expected.includes(message)), "画面の実行時エラー・警告").toEqual([]);
  },
});

export { expect };

export async function attachImage(testInfo: TestInfo, name: string, image: Buffer) {
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}

// Choose through the same keyboard operation available to slot users.
export async function selectClassification(slot: Locator, name: string) {
  await expect(slot).toHaveAttribute("aria-disabled", "false");
  if (await slot.getAttribute("role") === "group") {
    await slot.getByRole("button").first().click();
    const button = slot.getByRole("button", { name, exact: true });
    if (await button.getAttribute("aria-pressed") !== "true") await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    return;
  }
  await slot.press("Home");
  await expect(slot).toHaveAttribute("aria-valuenow", "0");
  await expect(slot).toHaveAttribute("aria-disabled", "false");
  const limit = Number(await slot.getAttribute("aria-valuemax"));
  for (let index = 0; index < limit && await slot.getAttribute("aria-valuetext") !== name; index++) {
    await slot.press("ArrowDown");
    await expect(slot).toHaveAttribute("aria-valuenow", String(index + 1));
    await expect(slot).toHaveAttribute("aria-disabled", "false");
  }
  await expect(slot).toHaveAttribute("aria-valuetext", name);
}

// New registration always starts from the initiative list.
export async function openInitiativeEntry(target: FrameLocator | Page) {
  await target.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await target.getByRole("button", { name: "施策を追加", exact: true }).click();
  await expect(target.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
}
