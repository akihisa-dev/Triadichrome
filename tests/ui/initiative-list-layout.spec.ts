import { test, expect, settleMotion } from "./fixtures";

test("施策一覧は売上・費用・利益と固定見出しを表示し、画面内で縦横に移動する", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "施策一覧", exact: true }).locator(".home-relation-name").click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "施策一覧の月別売上・費用・利益", exact: true });
  const product = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "既存商品の販売拡大", exact: true }) });
  await expect(product.getByRole("cell").nth(0)).toHaveText("100,000");
  await expect(product.getByRole("cell").nth(1)).toHaveText("11,000");
  await expect(product.getByRole("cell").nth(2)).toHaveText("89,126");
  const reduction = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "通信運搬費と消耗品費の削減", exact: true }) });
  await expect(reduction.getByRole("cell").nth(1)).toHaveText("-3,751");
  const subsidy = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "助成金の受入れ", exact: true }) });
  await expect(subsidy.getByRole("cell").nth(16)).toHaveText("0");
  const metrics = await region.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: window.innerHeight,
    horizontal: node.scrollWidth > node.clientWidth, bar: getComputedStyle(node, "::-webkit-scrollbar").height }));
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.horizontal).toBe(true);
  expect(metrics.bar).toBe("12px");
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
  const before = await region.locator("thead").boundingBox();
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = node.scrollWidth; });
  expect(await region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await region.locator("thead").boundingBox())!.y - before!.y)).toBeLessThan(2);
  const name = (await region.getByRole("columnheader", { name: "施策名", exact: true }).boundingBox())!;
  const bounds = (await region.boundingBox())!;
  expect(Math.abs(name.x - bounds.x)).toBeLessThan(2);
  await expect(region.locator("thead tr").first().getByRole("columnheader", { name: "3月", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("fixed-header-expense.png") });
  expect(await app.locator(".home-content").evaluate(node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth)).toBe(true);
});
