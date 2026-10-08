import { test, expect } from "./fixtures";

test("4固定列の昇降順を切り替え、画面を離れると登録順へ戻る", async ({ app, page }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const menu = app.getByRole("navigation", { name: "メインナビゲーション" });
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  const table = app.getByRole("table", { name: "施策一覧", exact: true });
  const names = () => table.locator("tbody .initiative-name-button").allTextContents();
  const registration = await names();
  for (const label of ["展開名", "期間名", "施策名", "開始年月"]) {
    const header = table.getByRole("columnheader", { name: label, exact: true });
    await header.getByRole("button", { name: label, exact: true }).click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(header).toHaveText(`${label}▲`);
    await expect(table.locator("thead [aria-sort]")).toHaveCount(1);
    const ascending = await names();
    await header.getByRole("button", { name: label, exact: true }).press("Enter");
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(header).toHaveText(`${label}▼`);
    expect(await names()).not.toEqual(ascending);
  }
  await menu.getByRole("button", { name: "Home", exact: true }).click();
  await menu.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(table.locator("thead [aria-sort]")).toHaveCount(0);
  expect(await names()).toEqual(registration);
});
