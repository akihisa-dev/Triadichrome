import { openInitiativeEntry, test, expect } from "./fixtures";

test("ファイル終了は確認を挟み、キャンセルとEscで入力を保持する", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await openInitiativeEntry(app);
  const name = app.getByRole("textbox", { name: "施策名", exact: true });
  await name.fill("登録前の入力を保持");
  const close = app.getByRole("button", { name: "ファイルを閉じる", exact: true });
  const dialog = app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true });
  await close.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("画面テスト.triadic");
  await expect(dialog).toContainText("登録前の入力は失われます");
  await expect(dialog.getByRole("button", { name: "キャンセル", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(name).toHaveValue("登録前の入力を保持");
  await expect(close).toBeFocused();
  await close.click();
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(name).toHaveValue("登録前の入力を保持");
  await close.click();
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await openInitiativeEntry(app);
  await expect(name).toHaveValue("");
});

test("保存済みでも再読み込みに確認を表示し、中止すると同じ画面を保持する", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const pending = page.waitForEvent("dialog");
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  const dialog = await pending;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  const retry = page.waitForEvent("dialog");
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  await (await retry).accept();
  await expect(app.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
});

test("入口でもタブ終了の中止と確定を選べる", async ({ context }) => {
  const tab = await context.newPage();
  await tab.goto("/");
  await tab.getByRole("heading", { name: "Triadichrome", exact: true }).click();
  const pending = tab.waitForEvent("dialog");
  await tab.close({ runBeforeUnload: true });
  const dialog = await pending;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  expect(tab.isClosed()).toBe(false);
  await expect(tab.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
  const retry = tab.waitForEvent("dialog");
  const closed = tab.waitForEvent("close");
  await tab.close({ runBeforeUnload: true });
  await (await retry).accept();
  await closed;
  expect(tab.isClosed()).toBe(true);
});
