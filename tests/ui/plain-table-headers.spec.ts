import { test, expect } from "./fixtures";

test("4表とマスタ一覧は文字だけの列見出しで全件表示する", async ({ app, page }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  const menu = app.getByRole("complementary", { name: "メニュー" });
  for (const screen of ["施策一覧", "総原価表", "展開表", "明細"]) {
    await menu.getByRole("button", { name: screen, exact: true }).click();
    await expect(app.getByRole("heading", { name: screen, exact: true })).toBeVisible();
    await expect(app.locator("thead button")).toHaveCount(0);
    await expect(app.getByRole("button", { name: "クリア", exact: true })).toHaveCount(0);
    await expect(app.locator("thead [aria-sort]")).toHaveCount(0);
    if (screen === "施策一覧") await expect(app.locator("tbody tr")).toHaveCount(13);
  }
  for (const screen of ["勘定科目マスタ", "展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ"]) {
    await menu.getByRole("button", { name: "マスタ", exact: true }).click();
    await app.getByRole("button", { name: new RegExp(`^${screen}`) }).click();
    await expect(app.getByRole("heading", { name: screen, exact: true })).toBeVisible();
    await expect(app.locator("thead button")).toHaveCount(0);
    await expect(app.getByRole("button", { name: "クリア", exact: true })).toHaveCount(0);
    await expect(app.locator("thead [aria-sort]")).toHaveCount(0);
    if (screen === "勘定科目マスタ") {
      await expect(app.getByRole("button", { name: "売上高を並べ替え", exact: true })).toBeEnabled();
    }
  }
});
