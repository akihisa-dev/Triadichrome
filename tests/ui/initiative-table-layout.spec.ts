import { openInitiativeEntry, test, expect, settleMotion } from "./fixtures";

test("施策の月別入力を罫線付きのコンパクトな表で表示する", async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await openInitiativeEntry(app);
  await app.getByRole("heading", { name: "施策入力", exact: true }).click();
  await settleMotion(app.locator("body"));
  const table = app.getByRole("table", { name: "月別計画金額", exact: true });
  await expect(table.getByRole("columnheader")).toHaveCount(13);
  const row = table.locator("tbody tr").first();
  const layout = await row.evaluate(element => {
    const cell = element.querySelector("td")!;
    const select = element.querySelector("select")!;
    const remove = element.querySelector("button")!;
    return {
      border: getComputedStyle(cell).borderRightWidth,
      bottom: getComputedStyle(cell).borderBottomWidth,
      height: element.getBoundingClientRect().height,
      aligned: Math.abs(select.getBoundingClientRect().top - remove.getBoundingClientRect().top) < 2,
    };
  });
  expect(layout.border).toBe("1px");
  expect(layout.bottom).toBe("1px");
  expect(layout.height).toBeLessThan(50);
  expect(layout.aligned).toBe(true);
  await table.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).focus();
  await table.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption({ label: "401 売上高" });
  const amount = table.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  await amount.fill("123.456");
  await expect(amount).toHaveValue("123.456");
  await expect(app.getByRole("button", { name: "1行目を削除", exact: true })).toBeDisabled();
});
