import { test, expect, settleMotion } from "./fixtures";

test("合計行は見出し直下で固定し、並べ替えで変わらず種別切替で再計算する", async ({ app, page }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("heading", { name: "施策一覧", exact: true }).click();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "施策一覧の月別売上・費用・利益", exact: true });
  const total = region.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "合計", exact: true }) });
  await expect(total.getByRole("cell").nth(0)).toHaveText("435");
  await expect(total.getByRole("cell").nth(1)).toHaveText("47");
  await expect(total.getByRole("cell").nth(2)).toHaveText("388");
  const confirmed = await total.innerText();
  await region.getByRole("button", { name: "開始年月", exact: true }).click();
  expect(await total.innerText()).toBe(confirmed);
  await region.getByRole("button", { name: "開始年月", exact: true }).click();
  expect(await total.innerText()).toBe(confirmed);
  const before = (await total.boundingBox())!;
  const label = total.getByRole("rowheader", { name: "合計", exact: true });
  const labelBefore = (await label.boundingBox())!;
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = node.scrollWidth; });
  expect(await region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await total.boundingBox())!.y - before.y)).toBeLessThan(2);
  expect(Math.abs((await label.boundingBox())!.x - labelBefore.x)).toBeLessThan(2);
  await expect(label).toBeInViewport();
  await region.evaluate(node => { node.scrollLeft = 0; });
  await app.getByRole("button", { name: "一次予算", exact: true }).click();
  await expect(total.getByRole("cell").nth(0)).toHaveText("415");
  await expect(total.getByRole("cell").nth(2)).toHaveText("368");
});

test("施策未登録でも合計は0", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  const total = app.locator(".initiative-total-row");
  await expect(total.getByRole("cell")).toHaveCount(36);
  expect(await total.getByRole("cell").allTextContents()).toEqual(Array(36).fill("0"));
});
