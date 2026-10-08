import { test, expect, settleMotion } from "./fixtures";

test("施策一覧は売上・費用・利益と固定見出しを表示し、画面内で縦横に移動する", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "施策一覧", exact: true }).locator(".home-relation-name").click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "施策一覧の月別売上・費用・利益", exact: true });
  expect(await region.locator("thead tr").first().getByRole("columnheader").allTextContents()).toEqual(["展開名", "期間名", "施策名", "開始年月", ...[4,5,6,7,8,9,10,11,12,1,2,3].map(month => `${month}月`)]);
  const product = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "既存商品の販売拡大", exact: true }) });
  await expect(product.getByRole("cell").nth(3)).toHaveText("100");
  await expect(product.getByRole("cell").nth(4)).toHaveText("11");
  await expect(product.getByRole("cell").nth(5)).toHaveText("89");
  await expect(product.getByRole("cell").nth(0)).toHaveText("拡販");
  await expect(product.getByRole("cell").nth(1)).toHaveText("新規");
  const periodDifference = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "期間差の開始年月確認", exact: true }) });
  await expect(periodDifference.getByRole("cell").nth(1)).toHaveText("期間差");
  const reduction = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "通信運搬費と消耗品費の削減", exact: true }) });
  await expect(reduction.getByRole("cell").nth(0)).toHaveText("コスト");
  await expect(reduction.getByRole("cell").nth(4)).toHaveText("-4");
  const subsidy = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "助成金の受入れ", exact: true }) });
  await expect(subsidy.getByRole("cell").nth(19)).toHaveText("0");
  const metrics = await region.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: window.innerHeight,
    horizontal: node.scrollWidth > node.clientWidth, bar: getComputedStyle(node, "::-webkit-scrollbar").height }));
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.horizontal).toBe(true);
  expect(metrics.bar).toBe("12px");
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
  const before = await region.locator("thead").boundingBox();
  const fixedBefore = await region.locator(".initiative-list-fixed").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = node.scrollWidth; });
  expect(await region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await region.locator("thead").boundingBox())!.y - before!.y)).toBeLessThan(2);
  const name = (await region.getByRole("columnheader", { name: "施策名", exact: true }).boundingBox())!;
  const bounds = (await region.boundingBox())!;
  const start = (await region.getByRole("columnheader", { name: "開始年月", exact: true }).boundingBox())!;
  expect(Math.abs(start.x - name.x - name.width)).toBeLessThan(2);
  const fixedAfter = await region.locator(".initiative-list-fixed").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
  fixedAfter.forEach((x, index) => expect(Math.abs(x - fixedBefore[index]!)).toBeLessThan(2));
  const expansion = (await region.getByRole("columnheader", { name: "展開名", exact: true }).boundingBox())!;
  const period = (await region.getByRole("columnheader", { name: "期間名", exact: true }).boundingBox())!;
  expect(Math.abs(period.x - expansion.x - expansion.width)).toBeLessThan(2);
  expect(Math.abs(name.x - period.x - period.width)).toBeLessThan(2);
  expect(bounds.width - expansion.width - period.width - name.width - start.width).toBeGreaterThan(40);
  if (testInfo.project.name === "narrow") {
    expect(name.width).toBeLessThan(220);
    expect(start.width).toBeLessThan(112);
    expect((await reduction.getByRole("rowheader").boundingBox())!.height).toBeGreaterThan(50);
  }
  expect(Math.abs(expansion.x - bounds.x)).toBeLessThan(2);
  await expect(region.locator("thead tr").first().getByRole("columnheader", { name: "3月", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("fixed-header-expense.png") });
  expect(await app.locator(".home-content").evaluate(node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth)).toBe(true);
});
