import { test, expect, settleMotion } from "./fixtures";

test("画面の保存項目と参照先をたどり、関連図の入口へ戻れる", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "画面とデータ", exact: true }).click();
  const map = app.getByRole("region", { name: "画面とデータの対応図" });
  await expect(map.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(map.locator("#screen-data-initiatives")).toContainText("primary_start_year_month");
  await map.getByRole("navigation").getByRole("button", { name: "施策詳細", exact: true }).click();
  await map.locator("#screen-data-initiatives .screen-data-table-heading").click();
  await map.getByRole("button", { name: "expansions.id", exact: true }).click();
  await expect(map.locator("#screen-data-expansions .screen-data-columns")).toBeVisible();
  await expect(map.locator("#screen-data-expansions .screen-data-table-heading")).toBeFocused();
  const screens = map.getByRole("navigation");
  await screens.getByRole("button", { name: "総原価表", exact: true }).click();
  await expect(map.locator("#screen-data-aggregation_members")).toBeVisible();
  await expect(map).toContainText("総原価表専用の保存テーブルはありません");
  await screens.getByRole("button", { name: "種別マスタ", exact: true }).click();
  await expect(map.locator(".screen-data-table")).toHaveCount(1);
  await expect(map).toContainText("アプリの固定定義");
  for (const name of ["施策入力", "施策詳細", "前年入力", "展開表", "明細", "勘定科目マスタ", "集計マスタ", "展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ", "履歴"]) {
    await screens.getByRole("button", { name, exact: true }).click();
    await expect(map.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(map).toContainText("data_history_state");
  await expect.poll(() => map.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await app.getByRole("button", { name: "関連図", exact: true }).click();
  await settleMotion(app.locator("body"));
  await expect(app.getByRole("region", { name: "画面とマスタの相関図" })).toBeVisible();
  await expect(app.getByRole("button", { name: "操作を取り消す", exact: true })).toBeDisabled();
  await app.getByRole("main", { name: "ホーム" }).getByRole("button", { name: "施策一覧", exact: true }).press("Enter");
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
});
