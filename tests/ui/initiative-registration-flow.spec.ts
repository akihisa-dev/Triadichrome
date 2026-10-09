import { test, expect, openInitiativeEntry, selectClassification, settleMotion } from "./fixtures";

test.beforeEach(async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html?data=full");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  if (testInfo.title.startsWith("登録失敗")) {
    await app.locator("body").evaluate(() => {
      const target = window as unknown as Window & { showOpenFilePicker: () => Promise<FileSystemFileHandle[]> };
      const original = target.showOpenFilePicker;
      Object.defineProperty(target, "showOpenFilePicker", { value: async () => {
        const handles = await original();
        const handle = handles[0]!;
        const create = handle.createWritable.bind(handle);
        let writes = 0;
        Object.defineProperty(handle, "createWritable", { value: async () => {
          if (++writes === 1) throw new Error("テスト用の保存失敗");
          return create();
        } });
        return handles;
      } });
    });
  }
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
});

test("入口を一覧へ統一し、空欄なら確認なしで戻り、登録成功後に一覧で確認できる", async ({ app }) => {
  const menu = app.getByRole("navigation", { name: "メインナビゲーション" });
  await expect(menu.getByRole("button", { name: "施策入力", exact: true })).toHaveCount(0);
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await expect(home.getByRole("button", { name: "施策入力", exact: true })).toHaveCount(0);
  await settleMotion(app.locator("body"));
  await home.getByRole("button", { name: "施策一覧", exact: true }).press("Enter");
  const kind = app.getByRole("spinbutton", { name: "種別", exact: true });
  await expect(kind).toHaveAttribute("aria-valuetext", "確定予算");
  await app.getByRole("button", { name: "施策を追加", exact: true }).click();
  await expect(menu.getByRole("button", { name: "施策一覧", exact: true })).toHaveAttribute("aria-current", "page");
  await app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(app.getByRole("alertdialog")).not.toBeVisible();
  await openInitiativeEntry(app);
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("一覧からの新規登録");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("登録後に一覧へ戻る");
  await selectClassification(app.getByRole("spinbutton", { name: "展開名", exact: true }), "コスト");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).focus();
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "401 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("123.456");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(kind).toHaveAttribute("aria-valuetext", "確定予算");
  await expect(app.getByRole("button", { name: "一覧からの新規登録", exact: true })).toBeVisible();
  await openInitiativeEntry(app);
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("");
  await expect(app.getByRole("combobox", { name: "1行目の勘定科目" })).toHaveValue("");
});

for (const exit of ["戻るボタン", "サイドバー", "画面履歴"] as const) {
  test(exit + "で一覧へ戻ると破棄確認を挟み、キャンセル・Escは入力保持、確定後は空欄", async ({ app }) => {
    await openInitiativeEntry(app);
    const name = app.getByRole("textbox", { name: "施策名", exact: true });
    const note = app.getByRole("textbox", { name: "備考", exact: true });
    await name.fill("未登録の施策");
    await note.fill("破棄しない備考");
    await selectClassification(app.getByRole("spinbutton", { name: "期間名", exact: true }), "新規");
    await app.getByRole("combobox", { name: "1行目の勘定科目" }).focus();
    await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "401 売上高" });
    await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("12.345");
    const leave = () => exit === "戻るボタン"
      ? app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click()
      : exit === "サイドバー"
        ? app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click()
        : app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
    const dialog = app.getByRole("alertdialog", { name: "入力内容を破棄しますか？", exact: true });
    await leave();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "キャンセル", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(name).toHaveValue("未登録の施策");
    await expect(note).toHaveValue("破棄しない備考");
    await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true })).toHaveValue("12.345");
    await leave();
    await dialog.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(note).toHaveValue("破棄しない備考");
    await leave();
    await dialog.getByRole("button", { name: "破棄して一覧へ戻る", exact: true }).click();
    await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
    await expect(app.getByRole("button", { name: "未登録の施策", exact: true })).toHaveCount(0);
    await openInitiativeEntry(app);
    await expect(name).toHaveValue("");
    await expect(note).toHaveValue("");
    await expect(app.getByRole("spinbutton", { name: "期間名", exact: true })).toHaveAttribute("aria-valuetext", "未選択");
    await expect(app.getByRole("combobox", { name: "1行目の勘定科目" })).toHaveValue("");
  });
}

test("備考だけ・分類だけの入力も一覧への帰還で確認する", async ({ app }) => {
  for (const field of ["備考", "期間名"]) {
    await openInitiativeEntry(app);
    if (field === "備考") await app.getByRole("textbox", { name: field, exact: true }).fill("備考のみ");
    else await selectClassification(app.getByRole("spinbutton", { name: field, exact: true }), "新規");
    await app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click();
    const dialog = app.getByRole("alertdialog", { name: "入力内容を破棄しますか？", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "破棄して一覧へ戻る", exact: true }).click();
  }
});

test("登録失敗では入力画面と内容を保ち、再試行成功で一覧へ戻る", async ({ app }) => {
  await openInitiativeEntry(app);
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("再試行する施策");
  await selectClassification(app.getByRole("spinbutton", { name: "展開名", exact: true }), "コスト");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).focus();
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "401 売上高" });
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("テスト用の保存失敗");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("再試行する施策");
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("button", { name: "再試行する施策", exact: true })).toBeVisible();
});
