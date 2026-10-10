import { test, expect, openInitiativeEntry, selectClassification } from "./fixtures";
import type { FrameLocator, Locator } from "@playwright/test";

const cell = (app: FrameLocator, month: number) => app.getByRole("spinbutton", { name: `売上高 ${month}月の金額`, exact: true });
async function badInput(input: Locator, text: string) {
  await input.click(); await input.press("ControlOrMeta+A"); await input.pressSequentially(text);
  await expect.poll(() => input.evaluate(node => (node as HTMLInputElement).validity.badInput)).toBe(true);
}
async function paste(input: Locator, text: string) {
  await input.click();
  await input.evaluate((node, value) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", value);
    node.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
  }, text);
}
async function savedBytes(app: FrameLocator) {
  return app.locator("body").evaluate(() => (window as Window & { readIssueBytes?: () => Promise<number[]> }).readIssueBytes!());
}
async function blocked(app: FrameLocator) {
  await expect(app.getByRole("button", { name: "保存を再試行", exact: true })).toBeEnabled();
  await expect(app.getByRole("alert")).toContainText("有効な数値");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeDisabled();
}
async function reopen(app: FrameLocator) {
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog").getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "不正入力の保存確認", exact: true }).click();
}

test.beforeEach(async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const original = target.showOpenFilePicker!;
    Object.defineProperty(target, "showOpenFilePicker", { configurable: true, value: async () => {
      const handles = await original(), handle = handles[0]!;
      Object.defineProperty(target, "readIssueBytes", { configurable: true, value: async () => Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer())) });
      return handles;
    } });
  });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await openInitiativeEntry(app);
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("不正入力の保存確認");
  for (const [name, value] of [["展開名", "コスト"], ["部署名", "部署A"], ["業種名", "直営自動車"]] as const) {
    await selectClassification(app.getByRole("combobox", { name, exact: true }), value);
  }
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).focus();
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption("1");
  await cell(app, 4).fill("10"); await cell(app, 5).fill("5");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await cell(app, 4).fill("20"); await cell(app, 5).fill("6");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "不正入力の保存確認", exact: true }).click();
});

for (const kind of ["一次予算", "確定予算"] as const) for (const text of ["-", "1e"]) for (const operation of ["入力", "貼付", "範囲消去"] as const) {
  test(`${kind}の${text}は種別切替後の${operation}で保存されず、元セルの取消で復帰する`, async ({ app }) => {
    const before = await savedBytes(app);
    await app.getByRole("tab", { name: kind, exact: true }).click();
    await badInput(cell(app, 4), text); await blocked(app);
    const other = kind === "一次予算" ? "確定予算" : "一次予算";
    await app.getByRole("tab", { name: other, exact: true }).click();
    if (operation === "入力") await cell(app, 5).fill("8");
    else if (operation === "貼付") await paste(cell(app, 5), "8\t9");
    else {
      await cell(app, 5).click(); await cell(app, 5).press("Shift+ArrowRight"); await cell(app, 6).press("Delete");
    }
    await blocked(app);
    await app.getByRole("button", { name: "保存を再試行", exact: true }).click(); await blocked(app);
    expect(await savedBytes(app)).toEqual(before);
    await app.getByRole("tab", { name: kind, exact: true }).click();
    await expect(cell(app, 4)).toHaveAttribute("aria-invalid", "true");
    await cell(app, 4).press("Escape");
    await expect(cell(app, 4)).toHaveValue(kind === "一次予算" ? "10" : "20");
    await expect(cell(app, 4)).toHaveAttribute("aria-invalid", "false");
    await reopen(app);
    await expect(cell(app, 4)).toHaveValue("10");
    await app.getByRole("tab", { name: "確定予算", exact: true }).click();
    await expect(cell(app, 4)).toHaveValue("20");
    await app.getByRole("tab", { name: other, exact: true }).click();
    await expect(cell(app, 5)).toHaveValue(operation === "範囲消去" ? "0" : "8");
    if (operation === "貼付") await expect(cell(app, 6)).toHaveValue("9");
  });
}

test("両種別の不正セルは独立して保持し、訂正と明示的な消去で保存できる", async ({ app }) => {
  const before = await savedBytes(app);
  await badInput(cell(app, 4), "-");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await badInput(cell(app, 5), "1e"); await blocked(app);
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await cell(app, 4).fill("0"); await blocked(app);
  expect(await savedBytes(app)).toEqual(before);
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(cell(app, 5)).toHaveAttribute("aria-invalid", "true");
  await cell(app, 5).press("Backspace");
  await expect(cell(app, 5)).toHaveValue("0");
  await reopen(app); await expect(cell(app, 4)).toHaveValue("0");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(cell(app, 5)).toHaveValue("0");
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await cell(app, 5).fill("9");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(cell(app, 5)).toHaveValue("0");
});

test("不正な確定予算のセルを取消した後も一次予算を引き継ぐ", async ({ app }) => {
  await cell(app, 6).fill("13");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(cell(app, 6)).toHaveValue("13");
  await badInput(cell(app, 6), "1e"); await blocked(app);
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await cell(app, 5).fill("8"); await blocked(app);
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await cell(app, 6).press("Escape"); await expect(cell(app, 6)).toHaveValue("13");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await cell(app, 6).fill("14");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await expect(cell(app, 6)).toHaveValue("14");
});

test("不正入力を含む全体の取消は保存済みの両種別へ戻す", async ({ app }) => {
  const before = await savedBytes(app);
  await badInput(cell(app, 4), "-"); await blocked(app);
  await app.getByRole("tab", { name: "確定予算", exact: true }).click();
  await cell(app, 5).fill("8"); await blocked(app);
  await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await expect(cell(app, 4)).toHaveValue("20"); await expect(cell(app, 5)).toHaveValue("6");
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await expect(cell(app, 4)).toHaveValue("10"); await expect(cell(app, 4)).toHaveAttribute("aria-invalid", "false");
  expect(await savedBytes(app)).toEqual(before);
});

test("新規登録でも別種別の不正入力を訂正するまで保存しない", async ({ app }) => {
  await app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click();
  await app.getByRole("button", { name: "施策を追加", exact: true }).click();
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("新規の不正入力");
  for (const [name, value] of [["展開名", "コスト"], ["部署名", "部署A"], ["業種名", "直営自動車"]] as const) await selectClassification(app.getByRole("combobox", { name, exact: true }), value);
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).focus();
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption("1");
  await badInput(cell(app, 4), "-");
  await app.getByRole("tab", { name: "確定予算", exact: true }).click(); await cell(app, 5).fill("8");
  const before = await savedBytes(app);
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("有効な数値");
  expect(await savedBytes(app)).toEqual(before);
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  await expect(cell(app, 4)).toHaveAttribute("aria-invalid", "true");
  // After cancelling bad input, an intentional blank still means zero.
  await cell(app, 4).press("Escape"); await cell(app, 4).fill("");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "新規の不正入力", exact: true }).click();
  await expect(cell(app, 4)).toHaveValue("0");
});
