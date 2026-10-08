import { test, expect } from "@playwright/test";
import { settleMotion } from "./fixtures";

test("総原価表の科目・集計列を縦横スクロール中も左端に表示する", async ({ page }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  const app = page.frameLocator("#app-preview");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "総原価表", exact: true }).click();
  const closeSidebar = app.getByRole("button", { name: "サイドバーを閉じる", exact: true });
  if (await closeSidebar.count()) await closeSidebar.last().click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "総原価表の月別前年・種別別金額", exact: true });
  const positions = () => region.evaluate(node => {
    const table = node.querySelector("table")!;
    const left = node.getBoundingClientRect().left;
    const nameCells = [table.querySelector("thead th[scope=col]")!, table.querySelector("thead th[scope=row]")!, table.querySelector("tbody th[scope=row]")!];
    return { scroll: node.scrollLeft, names: nameCells.map(cell => cell.getBoundingClientRect().left - left), amount: table.querySelector("td")!.getBoundingClientRect().left - left };
  });
  const before = await positions();
  await region.evaluate(node => { node.scrollLeft = 900; });
  await expect.poll(async () => (await positions()).scroll).toBeGreaterThan(0);
  const after = await positions();
  after.names.forEach((left, index) => expect(Math.abs(left - before.names[index]!)).toBeLessThan(2));
  expect(after.amount).toBeLessThan(before.amount - 100);
  await region.evaluate(node => { node.scrollTop = 120; });
  await expect.poll(() => region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const both = await positions();
  both.names.forEach((left, index) => expect(Math.abs(left - before.names[index]!)).toBeLessThan(2));
});
