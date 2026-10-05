import { test, expect, settleMotion } from "./fixtures";

const destinations = ["勘定科目マスタ", "集計マスタ", "業種マスタ", "部署マスタ", "期間マスタ", "展開マスタ", "施策入力", "総原価表", "施策一覧", "明細", "展開表"];

test("ホームの相関図から全画面へ移動し、入力を保持する", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  for (const name of destinations) {
    const home = app.getByRole("main", { name: "ホーム", exact: true });
    await expect(home.getByRole("button")).toHaveCount(11);
    await home.getByRole("button", { name, exact: true }).click();
    await expect(app.getByRole("heading", { name, exact: true })).toBeVisible();
    if (name === "施策入力") await app.getByRole("textbox", { name: "施策名", exact: true }).fill("ホームからの入力保持");
    await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  }
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "施策入力", exact: true }).press("Enter");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("ホームからの入力保持");
});

test("図のキーボード操作、関係の強調と横スクロールの復元", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await page.setViewportSize({ width: 600, height: 800 });
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  await home.getByRole("button", { name: "施策入力", exact: true }).focus();
  await expect(home.locator(".home-relation.is-active")).toHaveCount(9);
  await viewport.evaluate(node => { node.scrollLeft = 450; });
  await home.getByRole("button", { name: "明細", exact: true }).focus();
  await settleMotion(app.locator("body"));
  const left = await viewport.evaluate(node => node.scrollLeft);
  expect(left).toBeGreaterThan(0);
  await home.getByRole("button", { name: "明細", exact: true }).press("Space");
  await expect(app.getByRole("heading", { name: "明細", exact: true })).toBeVisible();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  await settleMotion(app.locator("body"));
  expect(await viewport.evaluate(node => node.scrollLeft)).toBeCloseTo(left, 0);
  expect(await app.locator("body").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});
