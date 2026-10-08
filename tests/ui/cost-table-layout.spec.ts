import { test, expect, settleMotion, selectClassification } from "./fixtures";

test("総原価表の見出しと比較対象を一行にまとめ、狭い画面でも選択できる", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー", exact: true }).getByRole("button", { name: "総原価表", exact: true }).click();
  await page.mouse.move(0, 0);
  await settleMotion(app.locator("body"));
  const heading = app.locator(".cost-table-page .initiative-list-heading");
  const metrics = await heading.evaluate(node => {
    const rects = Array.from(node.querySelectorAll("h1, .field-hint, [role=spinbutton]")).map(item => item.getBoundingClientRect());
    return { centers: rects.map(rect => rect.y + rect.height / 2), height: node.getBoundingClientRect().height,
      inside: rects.every(rect => rect.left >= 0 && rect.right <= window.innerWidth),
      bodyOverflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  expect(metrics.inside).toBe(true);
  expect(metrics.bodyOverflow).toBe(false);
  if (testInfo.project.name === "desktop") {
    expect(Math.max(...metrics.centers) - Math.min(...metrics.centers)).toBeLessThan(2);
    expect(metrics.height).toBeLessThanOrEqual(72);
  }
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "確定予算");
  await expect(app.getByRole("table", { name: "総原価表", exact: true }).getByRole("columnheader", { name: "確定予算", exact: true })).toHaveCount(19);
});

test("総原価表は画面内で縦横に移動でき、見出しから社内控除後売上までと科目名を固定する", async ({ page, app }, testInfo) => {
  // The frozen 13-row header needs enough vertical space to fit.
  // Keep the narrow width; 800px interaction coverage remains in other tests.
  if (testInfo.project.name === "narrow") await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー", exact: true }).getByRole("button", { name: "総原価表", exact: true }).click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "総原価表の月別前年・種別別金額", exact: true });
  await region.click();
  await page.mouse.move(0, 0);
  await settleMotion(app.locator("body"));
  const metrics = await region.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const row = node.querySelector("tbody tr")!.getBoundingClientRect();
    return { bottom: rect.bottom, height: window.innerHeight, horizontal: node.scrollWidth > node.clientWidth,
      vertical: node.scrollHeight > node.clientHeight, rowHeight: row.height };
  });
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.height);
  expect(metrics.horizontal).toBe(true);
  expect(metrics.vertical).toBe(true);
  expect(metrics.rowHeight).toBeLessThanOrEqual(24);
  await page.screenshot({ path: testInfo.outputPath("compact.png") });
  const sales = region.getByRole("rowheader", { name: "社内控除後売上", exact: true });
  const initialSales = (await sales.boundingBox())!;
  const initialHeader = (await region.locator("thead").boundingBox())!;
  expect(initialHeader.height).toBeLessThanOrEqual(await region.evaluate(node => node.clientHeight));
  const initialSalesRow = (await region.getByRole("rowheader", { name: "売上高", exact: true }).boundingBox())!;
  const initialExpense = (await region.getByRole("rowheader", { name: "旅費", exact: true }).boundingBox())!;
  await region.evaluate(node => { node.scrollTop = 700; node.scrollLeft = node.scrollWidth; });
  const bounds = (await region.boundingBox())!;
  const anchor = (await sales.boundingBox())!;
  expect(Math.abs(anchor.y - initialSales.y)).toBeLessThan(2);
  expect(Math.abs(anchor.x - bounds.x)).toBeLessThan(2);
  const last = region.locator(".cost-sales-anchor td").last();
  const lastBounds = (await last.boundingBox())!;
  expect(lastBounds.x + lastBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(Math.abs(lastBounds.y - initialSales.y)).toBeLessThan(2);
  const header = (await region.locator("thead").boundingBox())!;
  expect(Math.abs(header.y - initialHeader.y)).toBeLessThan(2);
  expect(header.height).toBe(initialHeader.height);
  expect(Math.abs((await region.getByRole("rowheader", { name: "売上高", exact: true }).boundingBox())!.y - (header.y + initialSalesRow.y - initialHeader.y))).toBeLessThan(2);
  expect((await region.getByRole("rowheader", { name: "旅費", exact: true }).boundingBox())!.y).toBeLessThan(initialExpense.y);
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
  expect(Math.abs((await sales.boundingBox())!.y - initialSales.y)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath("fixed-sales.png") });
  await region.evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
  expect((await sales.boundingBox())!.y).toBeGreaterThan(bounds.y + 200);
});
