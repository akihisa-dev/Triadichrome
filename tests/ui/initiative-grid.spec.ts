import { openInitiativeEntry, test, expect, selectClassification, settleMotion } from "./fixtures";
import type { Locator } from "@playwright/test";

async function paste(cell: Locator, text: string) {
  await cell.evaluate((node, value) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", value);
    node.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
  }, text);
}

test.beforeEach(async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await openInitiativeEntry(app);
  await app.getByRole("heading", { name: "施策入力", exact: true }).click();
  await settleMotion(app.locator("body"));
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption("1");
  await app.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
  await app.getByRole("combobox", { name: "2行目の勘定科目", exact: true }).selectOption("1");
});

test("複数行・月の貼り付け、範囲コピー・同値入力・消去と引き継ぎ", async ({ page, app }, testInfo) => {
  const cell = (row: number, month: number) => app.getByRole("spinbutton", { name: `売上高 ${month}月の金額`, exact: true }).nth(row);
  const april = cell(0, 4);
  await april.click();
  await paste(april, "1,200.125\t-0.001\r\n25\t0\r\n");
  await expect(april).toHaveValue("1200.125");
  await expect(cell(0, 5)).toHaveValue("-0.001");
  await expect(cell(1, 4)).toHaveValue("25");
  await april.press("Shift+ArrowRight");
  await cell(0, 5).press("Shift+ArrowDown");
  await expect(app.locator(".initiative-cell-selected")).toHaveCount(4);
  const copied = await cell(1, 5).evaluate(node => {
    const clipboardData = new DataTransfer();
    node.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, clipboardData }));
    return clipboardData.getData("text/plain");
  });
  expect(copied).toBe("1200.125\t-0.001\n25\t0");
  await cell(1, 5).press("2");
  await cell(1, 5).press("ControlOrMeta+Enter");
  await cell(1, 5).press("3");
  await expect(cell(1, 5)).toHaveValue("3");
  await cell(1, 5).fill("3.125");
  await cell(1, 5).press("ControlOrMeta+Enter");
  for (const row of [0, 1]) for (const month of [4, 5]) await expect(cell(row, month)).toHaveValue("3.125");
  await cell(1, 5).press("Delete");
  for (const row of [0, 1]) for (const month of [4, 5]) await expect(cell(row, month)).toHaveValue("0");
  await paste(cell(1, 5), "8.001");
  for (const row of [0, 1]) for (const month of [4, 5]) await expect(cell(row, month)).toHaveValue("8.001");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(april).toHaveValue("8.001");
  await april.click(); await april.press("Shift+ArrowRight");
  await cell(0, 5).press("Shift+ArrowDown");
  await paste(cell(1, 5), "0");
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await expect(april).toHaveValue("8.001");
  await april.fill("10");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(april).toHaveValue("0");
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: testInfo.outputPath("initiative-grid.png") });
});

test("不正・表外・科目未選択の保護とセル移動", async ({ app }) => {
  const cell = (row: number, month: number) => app.getByRole("spinbutton", { name: `売上高 ${month}月の金額`, exact: true }).nth(row);
  const april = cell(0, 4);
  await april.click(); await paste(april, "7\t8\n9\t10");
  for (const text of ["1\t2\n3\t不正", "0.0001", "1\t2\n3", "=1+2"]) {
    await paste(april, text);
    await expect(app.getByRole("alert")).toBeVisible();
    await expect(april).toHaveValue("7");
    await expect(cell(1, 5)).toHaveValue("10");
  }
  await cell(0, 3).click(); await paste(cell(0, 3), "1\t2");
  await expect(app.getByRole("alert")).toContainText("外");
  await expect(cell(0, 3)).toHaveValue("0");
  await app.getByRole("button", { name: "通知を閉じる", exact: true }).click();
  await app.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
  await cell(1, 4).click(); await paste(cell(1, 4), "1\n2");
  await expect(app.getByRole("alert")).toContainText("勘定科目");
  await expect(cell(1, 4)).toHaveValue("9");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(april).toBeEnabled();
  await cell(0, 10).click();
  await cell(0, 10).press("Escape");
  await paste(cell(0, 10), "15\t-0.001");
  await expect(cell(0, 10)).toHaveValue("15");
  await expect(cell(0, 11)).toHaveValue("-0.001");
  await expect(april).toHaveValue("7");
  await cell(0, 10).press("Tab");
  await expect(cell(0, 11)).toBeFocused();
  await cell(0, 11).press("Shift+Tab");
  await expect(cell(0, 10)).toBeFocused();
  await cell(0, 10).press("Enter");
  await expect(cell(1, 10)).toBeFocused();
  await cell(1, 10).press("F2"); await cell(1, 10).fill("99"); await cell(1, 10).press("Escape");
  await expect(cell(1, 10)).toHaveValue("0");
});

test("ドラッグで矩形を選択して保存し、開き直しても維持する", async ({ page, app }, testInfo) => {
  if (testInfo.project.name === "narrow") await page.setViewportSize({ width: 1280, height: 864 });
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("範囲入力の保存確認");
  for (const [name, value] of [["展開名", "コスト"], ["部署名", "部署A"], ["業種名", "直営自動車"]] as const) {
    await selectClassification(app.getByRole("spinbutton", { name, exact: true }), value!);
  }
  const cell = (row: number, month: number) => app.getByRole("spinbutton", { name: `売上高 ${month}月の金額`, exact: true }).nth(row);
  const start = (await cell(0, 4).boundingBox())!;
  const end = (await cell(1, 5).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down(); await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(app.locator(".initiative-cell-selected")).toHaveCount(4);
  await paste(cell(0, 4), "-0.001");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "範囲入力の保存確認", exact: true }).click();
  const full = app.getByRole("button", { name: "施策入力を開く", exact: true });
  if (await full.isVisible()) await full.click();
  for (const row of [0, 1]) for (const month of [4, 5]) await expect(cell(row, month)).toHaveValue("-0.001");
  await cell(0, 4).click(); await cell(0, 4).press("Shift+ArrowRight");
  await paste(cell(0, 5), "12.345");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog").getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "範囲入力の保存確認", exact: true }).click();
  if (await full.isVisible()) await full.click();
  await expect(cell(0, 4)).toHaveValue("12.345");
  await expect(cell(0, 5)).toHaveValue("12.345");
  await expect(cell(1, 4)).toHaveValue("-0.001");
});

test("範囲の自動保存が失敗しても入力と未変更セルを保持する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "展開表", exact: true }).click();
  await app.getByRole("button", { name: "既存商品の販売拡大", exact: true }).click();
  const april = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).first();
  const may = app.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true }).first();
  const june = app.getByRole("spinbutton", { name: "売上高 6月の金額", exact: true }).first();
  await april.click(); await april.press("Shift+ArrowRight");
  await paste(may, "-0.001");
  await expect(app.getByRole("alert")).toContainText("自動保存できませんでした");
  await expect(april).toHaveValue("-0.001"); await expect(may).toHaveValue("-0.001");
  await expect(june).toHaveValue("130000");
  await expect(app.getByRole("button", { name: "← 展開表へ戻る", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("自動保存できませんでした");
  await expect(april).toHaveValue("-0.001");
  await app.getByRole("button", { name: "未保存の変更を戻す", exact: true }).click();
  await expect(april).toHaveValue("120000"); await expect(may).toHaveValue("125000");
});
