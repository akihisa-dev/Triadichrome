import { test, expect, settleMotion } from "./fixtures";

test("勘定科目マスタの表は見出しを固定し、狭い画面では表内をスクロールする", async ({ app, page }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  await settleMotion(app.locator("body"));
  const table = app.getByRole("table", { name: "科目・集計一覧", exact: true });
  await expect(table.getByRole("columnheader")).toHaveText(["順序", "区分", "科目コード", "名称", "表示名", "科目属性", "集計", "加減", "操作"]);
  const region = app.getByRole("region", { name: "科目・集計一覧", exact: true });
  const header = table.getByRole("columnheader").first();
  const top = (await header.boundingBox())!.y;
  await region.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect((await header.boundingBox())!.y).toBeCloseTo(top, 0);
  expect(await app.locator(".home-content").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await region.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  await app.getByRole("button", { name: "売上集計を編集", exact: true }).click();
  await expect(table.getByRole("textbox", { name: "売上集計の表示名", exact: true })).toBeVisible();
  await expect(table.getByRole("textbox", { name: "売上集計の名称", exact: true })).toHaveCount(0);
  await expect(app.getByRole("combobox", { name: "売上集計の集計", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "完了", exact: true }).click();
});
