import { test, expect, settleMotion } from "./fixtures";

test("総原価表は画面内で縦横に移動でき、社内控除後売上と科目名を固定する", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "総原価表", exact: true }).click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "総原価表の月別前年・種別別金額", exact: true });
  const metrics = await region.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const row = node.querySelector("tbody tr")!.getBoundingClientRect();
    return { bottom: rect.bottom, height: window.innerHeight, horizontal: node.scrollWidth > node.clientWidth,
      vertical: node.scrollHeight > node.clientHeight, rowHeight: row.height };
  });
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.height);
  expect(metrics.horizontal).toBe(true);
  expect(metrics.vertical).toBe(true);
  expect(metrics.rowHeight).toBeLessThanOrEqual(30);
  await page.screenshot({ path: testInfo.outputPath("compact.png") });
  const sales = region.getByRole("rowheader", { name: "社内控除後売上", exact: true });
  await region.evaluate(node => { node.scrollTop = 700; node.scrollLeft = node.scrollWidth; });
  const bounds = (await region.boundingBox())!;
  const anchor = (await sales.boundingBox())!;
  expect(Math.abs(anchor.y - bounds.y)).toBeLessThan(2);
  expect(Math.abs(anchor.x - bounds.x)).toBeLessThan(2);
  const last = region.locator(".cost-sales-anchor td").last();
  const lastBounds = (await last.boundingBox())!;
  expect(lastBounds.x + lastBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(Math.abs(lastBounds.y - bounds.y)).toBeLessThan(2);
  const header = (await region.locator("thead").boundingBox())!;
  expect(header.y + header.height).toBeLessThan(bounds.y);
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
  expect(Math.abs((await sales.boundingBox())!.y - bounds.y)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath("fixed-sales.png") });
  await region.evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
  expect((await sales.boundingBox())!.y).toBeGreaterThan(bounds.y + 200);
});
