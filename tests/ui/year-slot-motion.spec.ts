import { test, expect } from "./fixtures";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`年度スロットは数字が流れ、離した後に減速して止まる: ${reducedMotion}`, async ({ page, app }) => {
    await page.emulateMedia({ reducedMotion });
    const slot = app.getByRole("spinbutton", { name: "年度", exact: true });
    const selected = (await app.locator(".year-slot-selected").boundingBox())!;
    const x = selected.x + selected.width / 2;
    const y = selected.y + selected.height / 2;
    const original = Number(await slot.getAttribute("aria-valuenow"));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 18);
    // The reel follows the finger even between year positions.
    const flowing = await app.locator(".year-slot-number").evaluateAll(nodes => nodes.some(node => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return Math.abs(matrix.m42) > 1 && Math.abs(matrix.m42) < 35 && Number(getComputedStyle(node).opacity) > 0.2;
    }));
    expect(flowing).toBe(true);
    await page.mouse.move(x, y - 36);
    await page.mouse.up();
    const released = Number(await slot.getAttribute("aria-valuenow"));
    await expect(slot).toHaveAttribute("data-moving", "false");
    const stopped = Number(await slot.getAttribute("aria-valuenow"));
    expect(stopped).toBeGreaterThan(original);
    if (reducedMotion === "no-preference") expect(stopped).toBeGreaterThan(released);
    else expect(stopped).toBe(released);
    await slot.press("ArrowUp");
    await expect(slot).toHaveAttribute("data-moving", "false");
    await expect(slot).toHaveAttribute("aria-valuenow", String(stopped - 1));
    await app.getByRole("button", { name: "新規作成", exact: true }).click();
    await expect(app.locator(".home-header")).toContainText(`${stopped - 1}年度`);
  });
}

test("年度スロットの連続キー操作は最新の選択位置に止まる", async ({ app }) => {
  const slot = app.getByRole("spinbutton", { name: "年度", exact: true });
  const original = Number(await slot.getAttribute("aria-valuenow"));
  await slot.press("ArrowDown");
  await slot.press("ArrowDown");
  await slot.press("ArrowUp");
  await expect(slot).toHaveAttribute("data-moving", "false");
  await expect(slot).toHaveAttribute("aria-valuenow", String(original + 1));
  await app.getByRole("button", { name: "当年度", exact: true }).click();
  await expect(slot).toHaveAttribute("data-moving", "false");
  await expect(slot).toHaveAttribute("aria-valuenow", String(original));
});
