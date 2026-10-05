import { test, expect, settleMotion } from "./fixtures";

test("勘定科目一覧をコンパクトに表示し、縦横スクロール中も列見出しを保持する", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  await settleMotion(app.locator("body"));
  const list = app.getByRole("region", { name: "勘定科目一覧", exact: true });
  const header = list.getByRole("columnheader", { name: "科目コードで昇順に並べ替え 科目コードのフィルター", exact: true });
  await expect(list.locator("tbody")).toHaveCount(57);
  const before = await header.evaluate(node => node.getBoundingClientRect().top);
  expect(await list.locator("tbody tr").first().evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(44);
  await list.evaluate(node => { node.scrollTop = 500; node.scrollLeft = 120; });
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(400);
  await expect.poll(() => header.evaluate(node => node.getBoundingClientRect().top)).toBeCloseTo(before, 0);
  expect(await app.locator(".home-content").evaluate(node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth)).toBe(true);
  await list.evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
  await list.getByRole("button", { name: "売上高を編集", exact: true }).click();
  await expect(list.getByRole("textbox", { name: "売上高の科目名", exact: true })).toBeVisible();
});
