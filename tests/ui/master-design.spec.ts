import { test, expect, settleMotion } from "./fixtures";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("全マスタを共通の表で表示し、登録欄と一覧のスクロールを画面内に収める", async ({ app, page }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const masters = ["勘定科目", "展開", "業種", "部署", "期間", "種別"];
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  for (const [index, name] of masters.entries()) {
    await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "マスタ", exact: true }).click();
    await app.locator(".master-menu").getByRole("button", { name: new RegExp(`^${name}マスタ`) }).click();
    await settleMotion(app.locator("body"));
    const main = app.getByRole("main", { name: `${name}マスタ`, exact: true });
    await expect(main.locator(".master-count")).toContainText(/件|集計/);
    const table = main.getByRole("table");
    const colors = await main.locator("h1, .master-count, .primary-button, thead th, button[aria-label$=\"を編集\"]").evaluateAll(nodes => nodes.flatMap(node => {
      const style = getComputedStyle(node);
      return [style.color, style.backgroundColor].map(color => color.match(/[\d.]+/g)!.slice(0, 3).map(Number));
    }));
    for (const [red, green, blue] of colors) { expect(red).toBe(green); expect(green).toBe(blue); }
    await expect(table).toBeVisible();
    const region = main.getByRole("region");
    await expect(region).toHaveCSS("background-color", "rgb(255, 255, 255)");
    expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight)).toBe(true);
    const header = table.getByRole("columnheader").first();
    const top = (await header.boundingBox())!.y;
    await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect((await header.boundingBox())!.y).toBeCloseTo(top, 0);
    await region.evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
    if ([0, 1, 4].includes(index)) await page.screenshot({ path: join(tmpdir(), `triadichrome-master-${index}-${testInfo.project.name}.png`) });

  }
});
