import { test, expect, settleMotion } from "./fixtures";

test("展開表の3段見出しと名称列を縦横スクロール中も保持する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "展開表", exact: true }).click();
  const region = app.getByRole("region", { name: "展開表の月別種別・比較", exact: true });
  const header = region.locator("thead");
  await expect(header).toBeVisible();
  await settleMotion(app.locator("body"));
  const top = (await region.boundingBox())!.y;
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = 600; });
  await expect.poll(() => region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => Math.abs((await header.boundingBox())!.y - top)).toBeLessThan(2);
  const rows = await header.locator("tr").all();
  for (const row of rows) await expect(row).toBeInViewport();
  const group = header.getByRole("columnheader", { name: "展開名", exact: true });
  const name = header.getByRole("columnheader", { name: "施策名", exact: true });
  await expect(group).toBeInViewport();
  await expect(name).toBeInViewport();
  const bounds = await region.boundingBox();
  expect((await group.boundingBox())!.x).toBeCloseTo(bounds!.x, 0);
  expect((await name.boundingBox())!.x).toBeCloseTo(bounds!.x + (await group.boundingBox())!.width, 0);
  const firstCell = region.locator("tbody td").first();
  expect((await firstCell.boundingBox())!.y).toBeLessThan((await header.boundingBox())!.y);
});
