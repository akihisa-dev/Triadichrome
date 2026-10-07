import { openInitiativeEntry, test, expect, settleMotion } from "./fixtures";

test("基準年度は各画面でアプリ名の右隣に表示する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const year = app.getByLabel("基準年度", { exact: true });
  const yearText = await year.textContent();
  expect(yearText).toMatch(/^\d+年度$/);

  for (const name of ["Home", "前年入力", "施策一覧", "総原価表", "展開表", "明細", "マスタ"]) {
    await app.locator(".sidebar-navigation").getByRole("button", { name, exact: true }).click();
    await settleMotion(app.locator(".home-page"));
    await expect(year).toHaveText(yearText!);
    await expect(app.locator("main output")).toHaveCount(0);
    await expect(app.locator("main label").filter({ hasText: /^年度$/ })).toHaveCount(0);
    const bounds = await app.locator(".home-identity").evaluate(node => {
      const brand = node.querySelector(".home-brand")!.getBoundingClientRect();
      const year = node.querySelector("output")!.getBoundingClientRect();
      return { brandRight: brand.right, yearLeft: year.left, sameLine: Math.abs((brand.top + brand.bottom) / 2 - (year.top + year.bottom) / 2) < 1 };
    });
    expect(bounds.yearLeft).toBeGreaterThan(bounds.brandRight);
    expect(bounds.sameLine).toBe(true);
  }
  await openInitiativeEntry(app);
  await expect(year).toHaveText(yearText!);
  await app.locator(".sidebar-navigation").getByRole("button", { name: "明細", exact: true }).click();
  await expect(app.getByRole("columnheader", { name: "年度", exact: true })).toBeVisible();
  await app.locator(".sidebar-navigation").getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "既存商品の販売拡大", exact: true }).click();
  await app.getByRole("button", { name: "施策入力を開く", exact: true }).click();
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await expect(year).toHaveText(yearText!);
  await expect(app.locator("#initiative-year")).toHaveCount(0);
});
