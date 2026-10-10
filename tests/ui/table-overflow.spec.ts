import { test, expect } from "@playwright/test";

for (const scenario of ["monthly", "period", "previous", "difference", "normal"]) {
  test(`${scenario}: 集計失敗後も画面移動と金額修正ができる`, async ({ page }) => {
    const unexpected: string[] = [];
    page.on("pageerror", error => unexpected.push(error.message));
    page.on("console", message => {
      // React reports caught render errors in development; reject other errors.
      if (["error", "warning"].includes(message.type()) &&
        !message.text().includes("金額の合計が正確に計算できる範囲を超えています。")) unexpected.push(message.text());
    });
    await page.goto(`/tests/ui/preview.html?data=overflow-${scenario}`);
    await expect(page.getByRole("status")).toHaveText("操作できます");
    const app = page.frameLocator("#app-preview");
    await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    const nav = app.getByRole("navigation", { name: "メインナビゲーション" });
    for (const name of ["総原価表", "展開表"]) {
      await nav.getByRole("button", { name, exact: true }).click();
      await expect(app.getByRole("heading", { name, exact: true })).toBeVisible();
      if (scenario === "normal") await expect(app.getByRole("table", { name, exact: true })).toBeVisible();
      else {
        await expect(app.getByRole("alert")).toContainText("金額の合計が正確に計算できる範囲を超えています。");
        await expect(app.getByRole("table", { name, exact: true })).toHaveCount(0);
      }
      await expect(app.getByRole("button", { name: "ファイルを閉じる", exact: true })).toBeEnabled();
      await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
      await expect(app.getByRole("heading", { name, exact: true })).toHaveCount(0);
    }
    // Display conditions remain available and can recover without leaving a table.
    if (scenario === "monthly") {
      await nav.getByRole("button", { name: "総原価表", exact: true }).click();
      await app.getByRole("button", { name: "直営自動車", exact: true }).click();
      await expect(app.getByRole("table", { name: "総原価表", exact: true })).toBeVisible();
      await expect(app.getByRole("alert")).toHaveCount(0);
    }
    if (scenario === "difference") {
      for (const name of ["総原価表", "展開表"]) {
        await nav.getByRole("button", { name, exact: true }).click();
        await app.getByRole("spinbutton", { name: "比較対象2", exact: true }).press("Home");
        await expect(app.getByRole("table", { name, exact: true })).toBeVisible();
        await expect(app.getByRole("alert")).toHaveCount(0);
      }
    }
    await nav.getByRole("button", { name: "施策一覧", exact: true }).click();
    if (scenario === "monthly") {
      await expect(app.getByRole("alert")).toContainText("範囲を超えています");
      await expect(app.getByRole("button", { name: "上限確認A", exact: true })).toBeEnabled();
    }
    await app.getByRole("button", { name: "上限確認A", exact: true }).first().click();
    await app.getByRole("tab", { name: "一次予算", exact: true }).click();
    const april = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
    await april.fill("1"); await april.press("Tab");
    await expect(nav.getByRole("button", { name: "総原価表", exact: true })).toBeEnabled();
    for (const name of ["総原価表", "展開表"]) {
      await nav.getByRole("button", { name, exact: true }).click();
      await expect(app.getByRole("table", { name, exact: true })).toBeVisible();
      await expect(app.getByRole("alert")).toHaveCount(0);
    }
    await expect(app.locator("vite-error-overlay")).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}


test("相殺後が上限内なら三表・施策入力・期間計を表示する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tests/ui/preview.html?data=overflow-cancellation");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  const app = page.frameLocator("#app-preview");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const nav = app.getByRole("navigation", { name: "メインナビゲーション" });
  for (const name of ["総原価表", "展開表", "施策一覧"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    const table = app.getByRole("table", { name, exact: true });
    await expect(table).toBeVisible();
    await expect(table.getByText("9,007,199,254,741", { exact: true }).first()).toBeVisible();
    await expect(app.getByRole("alert")).toHaveCount(0);
  }
  await app.getByRole("button", { name: "相殺後の上限確認1", exact: true }).click();
  const input = app.getByRole("table", { name: "月別計画金額", exact: true });
  for (const kind of ["一次予算", "確定予算"]) {
    await app.getByRole("tab", { name: kind, exact: true }).click();
    await expect(input.getByRole("row", { name: /^売上合計/ }).getByRole("cell").first()).toHaveText("9,007,199,254,741");
    await expect(app.getByRole("alert")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
