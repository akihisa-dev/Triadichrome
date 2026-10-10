import { openInitiativeEntry, test, expect, selectClassification } from "./fixtures";

for (const failFirst of [false, true]) test(`所属変更${failFirst ? "の保存失敗と再試行" : "の成功"}で保持中の施策へ単一業種を反映する`, async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  if (failFirst) await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const open = target.showOpenFilePicker!;
    target.showOpenFilePicker = async () => {
      const handles = await open();
      const create = handles[0]!.createWritable.bind(handles[0]);
      let failed = false;
      handles[0]!.createWritable = async () => {
        if (!failed) { failed = true; throw new Error("所属変更の保存失敗"); }
        return create();
      };
      return handles;
    };
  });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await openInitiativeEntry(app);
  await selectClassification(app.getByRole("spinbutton", { name: "展開名", exact: true }), "料改");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await selectClassification(app.getByRole("spinbutton", { name: "期間名", exact: true }), "新規");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("所属変更後の施策");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("保持する備考");
  const account = app.getByRole("combobox", { name: "1行目の勘定科目", exact: true });
  await account.focus(); await account.selectOption("1");
  const amount = app.getByRole("table", { name: "月別計画金額", exact: true }).getByRole("spinbutton").first();
  await amount.fill("123.456");
  const master = app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "マスタ", exact: true });
  await master.click();
  await app.getByRole("button", { name: /^部署マスタ/ }).click();
  await app.getByRole("button", { name: "部署Aを編集", exact: true }).click();
  const choices = app.getByRole("group", { name: "部署Aの業種名", exact: true });
  // Batch the checkbox edits before the debounce timer starts saving.
  for (const checkbox of await choices.getByRole("checkbox").all()) {
    await checkbox.uncheck();
  }
  await choices.getByRole("checkbox", { name: "直営自動車", exact: true }).check();
  await choices.getByRole("checkbox", { name: "自動車取扱", exact: true }).check();
  if (failFirst) {
    await expect(app.getByRole("alert")).toContainText("所属変更の保存失敗");
    await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
    await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
    await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
    await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-valuetext", "未選択");
    await expect(amount).toHaveValue("123.456");
    await master.click(); await app.getByRole("button", { name: /^部署マスタ/ }).click();
    await app.getByRole("button", { name: "部署Aを編集", exact: true }).click();
    for (const checkbox of await choices.getByRole("checkbox").all()) await checkbox.uncheck();
    await choices.getByRole("checkbox", { name: "直営自動車", exact: true }).check();
    await choices.getByRole("checkbox", { name: "自動車取扱", exact: true }).check();
  }
  await expect(app.getByRole("button", { name: "完了", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "完了", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-valuetext", "未選択");
  await master.click(); await app.getByRole("button", { name: /^部署マスタ/ }).click();
  await app.getByRole("button", { name: "部署Aを編集", exact: true }).click();
  await choices.getByRole("checkbox", { name: "自動車取扱", exact: true }).uncheck();
  await expect(app.getByRole("button", { name: "完了", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "完了", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-valuetext", "直営自動車");
  await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("所属変更後の施策");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("保持する備考");
  await expect(amount).toHaveValue("123.456");
  await expect(app.getByRole("spinbutton", { name: "展開名", exact: true })).toHaveAttribute("aria-valuetext", "料改");
  await expect(app.getByRole("spinbutton", { name: "期間名", exact: true })).toHaveAttribute("aria-valuetext", "新規");
  await expect(app.getByRole("button", { name: "登録", exact: true })).toBeEnabled();
  await master.click(); await app.getByRole("button", { name: /^部署マスタ/ }).click();
  await app.getByRole("button", { name: "部署Aを編集", exact: true }).click();
  await choices.getByRole("checkbox", { name: "不動産A", exact: true }).check();
  await expect(app.getByRole("button", { name: "完了", exact: true })).toBeEnabled();
  await choices.getByRole("checkbox", { name: "直営自動車", exact: true }).uncheck();
  await expect(app.getByRole("alert")).toContainText("施策入力で選択している業種は部署から外せません");
  await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await app.getByRole("button", { name: "前の画面に戻る", exact: true }).click();
  await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-valuetext", "直営自動車");
  await expect(app.getByRole("spinbutton", { name: "業種名", exact: true })).toHaveAttribute("aria-disabled", "false");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("button", { name: "所属変更後の施策", exact: true })).toBeVisible();
});
