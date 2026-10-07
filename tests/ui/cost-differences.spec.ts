import { test, expect, selectClassification } from "./fixtures";

test("総原価表は予算の選択に応じて前年差と一次予算差を表示する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー", exact: true }).getByRole("button", { name: "総原価表", exact: true }).click();
  const table = app.getByRole("table", { name: "総原価表", exact: true });
  const sales = table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) });
  await expect(table.getByRole("columnheader", { name: "前年差", exact: true })).toHaveCount(19);
  await expect(table.getByRole("columnheader", { name: "一次予算差", exact: true })).toHaveCount(0);
  await expect(sales.getByRole("cell").nth(2)).toHaveText("350");
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "確定予算");
  await expect(table.getByRole("columnheader", { name: "一次予算差", exact: true })).toHaveCount(19);
  await expect(sales.getByRole("cell").nth(3)).toHaveText("380");
  await expect(sales.getByRole("cell").nth(4)).toHaveText("30");
  await expect(sales.getByRole("cell").nth(9)).toHaveText("-100");
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "未選択");
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象1", exact: true }), "確定予算");
  await expect(table.getByRole("columnheader", { name: "前年差", exact: true })).toHaveCount(19);
  await expect(table.getByRole("columnheader", { name: "一次予算差", exact: true })).toHaveCount(0);
  await expect(sales.getByRole("cell").nth(2)).toHaveText("380");
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "一次予算");
  await expect(table.locator("thead tr").nth(1).getByRole("columnheader").nth(1)).toHaveText("一次予算");
  await expect(sales.getByRole("cell").nth(3)).toHaveText("380");
  await expect(sales.getByRole("cell").nth(4)).toHaveText("30");
});
