import { test, expect, settleMotion, attachImage } from "./fixtures";

test("展開名ごとの集計・並び順・編集からの移動と再読込を確認する", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "展開表", exact: true }).click();
  const table = app.getByRole("table", { name: "展開表", exact: true });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "前年", exact: true }) }).getByRole("cell").first()).toHaveText("");
  await expect(table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "合計", exact: true }) }).getByRole("cell").first()).toHaveText("115,000");
  await expect(table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "展開計", exact: true }) }).getByRole("cell").first()).toHaveText("115,000");
  await expect(table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "撤退計", exact: true }) }).getByRole("cell").first()).toHaveText("0");
  await table.getByRole("button", { name: "施策名で昇順に並べ替え", exact: true }).click();
  const asc = await table.getByRole("button").allTextContents();
  await table.getByRole("button", { name: "施策名で降順に並べ替え", exact: true }).click();
  const desc = await table.getByRole("button").allTextContents();
  expect(asc).not.toEqual(desc);
  await table.getByRole("button", { name: "既存商品の販売拡大", exact: true }).click();
  await expect(app.getByRole("combobox", { name: "展開名", exact: true })).toHaveValue("5");
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("8");
  await expect(app.getByRole("button", { name: "← 展開表へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "← 展開表へ戻る", exact: true }).click();
  await expect(table.getByRole("button", { name: "施策名で昇順に並べ替え", exact: true })).toHaveText("施策名 ↓");
  const movedGroup = table.locator("tbody").filter({ has: app.getByRole("rowheader", { name: "効率", exact: true }) });
  await expect(movedGroup.getByRole("button", { name: "既存商品の販売拡大", exact: true })).toBeVisible();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^展開マスタ/ }).click();
  await expect(app.getByRole("button", { name: "効率を削除", exact: true })).toBeDisabled();
  await expect(app.getByRole("button", { name: "撤退を削除", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "展開表", exact: true }).click();
  await expect(table.getByRole("button", { name: "施策名で昇順に並べ替え", exact: true })).toHaveText("施策名");
  await expect(movedGroup.getByRole("button", { name: "既存商品の販売拡大", exact: true })).toBeVisible();
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "展開表の月別売上・利益", exact: true });
  expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await expect(table.getByRole("columnheader", { name: "3月", exact: true })).toBeInViewport();
  await region.evaluate(node => { node.scrollLeft = 0; });
  await attachImage(testInfo, "展開表", await page.locator("#app-preview").screenshot());
});

test("新規施策の展開名を必須にして保存し、失敗した変更を保持する", async ({ app }) => {
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle> };
    const original = target.showSaveFilePicker!;
    let writes = 0;
    Object.defineProperty(target, "showSaveFilePicker", { value: async (options: { suggestedName: string }) => {
      const handle = await original(options);
      const create = handle.createWritable.bind(handle);
      Object.defineProperty(handle, "createWritable", { value: async () => {
        if (++writes === 3) throw new Error("展開名変更の保存失敗");
        return create();
      } });
      return handle;
    } });
  });
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策入力", exact: true }).click();
  const expansion = app.getByRole("combobox", { name: "展開名", exact: true });
  await expect(expansion).toHaveValue("");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("展開割り当て確認");
  await expect(app.getByRole("button", { name: "登録", exact: true })).toBeDisabled();
  await expansion.selectOption("2");
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption({ label: "401 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("123.456");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "展開割り当て確認", exact: true }).click();
  await expect(expansion).toHaveValue("2");
  await expansion.selectOption("8");
  await expect(app.getByRole("alert")).toBeVisible();
  await expect(expansion).toHaveValue("8");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "未保存の変更を戻す", exact: true }).click();
  await expect(expansion).toHaveValue("2");
});
