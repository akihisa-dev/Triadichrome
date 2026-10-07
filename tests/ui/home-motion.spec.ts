import { test, expect, settleMotion } from "./fixtures";

test("ドラッグ後にカーソルとフォーカスが残っていても項目と線が自然に動く", async ({ page, app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await settleMotion(app.locator("body"));
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const icon = home.getByRole("button", { name: "業種マスタ", exact: true }).locator(".home-relation-icon");
  const node = home.locator('.home-relation-item:has([data-page="industry-master"])');
  const box = (await icon.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 8 });
  const before = await node.getAttribute("transform");
  const camera = await home.locator("svg.home-relations-map").getAttribute("style");
  await page.mouse.up();
  // Leave the pointer where the node was released; no hover-based pinning.
  await expect.poll(() => node.getAttribute("transform")).not.toBe(before);
  const samples = await node.evaluate(async node => {
    const first = node.getAttribute("transform");
    const line = node.closest("svg")!.querySelectorAll(".home-relation path");
    const paths = [...line].map(path => path.getAttribute("d"));
    for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return { moved: first !== node.getAttribute("transform"), lines: paths.some((value, i) => value !== line[i]!.getAttribute("d")) };
  });
  expect(samples.moved).toBe(true);
  expect(samples.lines).toBe(true);
  await expect(home).toBeVisible();
  await expect(home.locator("svg.home-relations-map")).toHaveAttribute("style", camera!);
});
