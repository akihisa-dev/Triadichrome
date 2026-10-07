import { tmpdir } from "node:os";
import { join } from "node:path";
import { openInitiativeEntry, test, expect, selectClassification, settleMotion } from "./fixtures";

test("更新を自動保存して再読込でき、失敗・入力不備で入力を残せる", async ({ app, page }, testInfo) => {
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const original = target.showOpenFilePicker!;
    let writes = 0;
    Object.defineProperty(target, "showOpenFilePicker", { value: async (options: unknown) => {
      if (Reflect.get(options as object, "mode") !== "readwrite") throw new Error("読み書き指定が必要です");
      const handles = await original();
      const handle = handles[0]!;
      const create = handle.createWritable.bind(handle);
      Object.defineProperty(handle, "createWritable", { value: async () => {
        if (++writes === 4) throw new Error("自動保存のテスト失敗");
        return create();
      } });
      return handles;
    } });
  });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  await app.getByRole("textbox", { name: "科目コード", exact: true }).fill("100");
  await app.getByRole("textbox", { name: "科目名", exact: true }).fill("売上高");
  await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption("sales");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await openInitiativeEntry(app);
  await selectClassification(app.getByRole("spinbutton", { name: "展開名", exact: true }), "コスト");
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("保存する施策");
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption({ label: "100 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("100");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "保存する施策", exact: true }).click();
  const amount = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  await expect(app.getByRole("button", { name: "保存を再試行", exact: true })).toHaveCount(0);
  await expect(app.getByRole("button", { name: "入力を取り消す", exact: true })).toHaveCount(0);
  await expect(app.getByText("保存済み", { exact: true })).toHaveCount(0);
  await amount.fill("125.5");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await expect(amount).toBeFocused();
  const note = app.getByRole("textbox", { name: "備考", exact: true });
  await note.fill("失敗しても残す備考");
  const inputBounds = await note.boundingBox();
  await expect(app.getByRole("alert")).toContainText("自動保存のテスト失敗");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("失敗しても残す備考");
  await expect(note).toBeFocused();
  expect(await note.boundingBox()).toEqual(inputBounds);
  await expect(app.locator(".status-notice").getByRole("button", { name: "保存を再試行", exact: true })).toBeEnabled();
  await expect(app.getByRole("button", { name: "ファイルを閉じる", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await expect(app.getByRole("alert")).toHaveCount(0);
  await expect(app.getByRole("button", { name: "保存を再試行", exact: true })).toHaveCount(0);
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("");
  await expect(app.getByRole("alert")).toContainText("施策名を入力");
  await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("保存する施策");
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.getByRole("row").filter({ has: app.getByRole("button", { name: "保存する施策", exact: true }) }).getByRole("cell").first()).toHaveText("126");
  await app.getByRole("button", { name: "保存する施策", exact: true }).click();
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("失敗しても残す備考");
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: join(tmpdir(), `triadichrome-auto-save-${testInfo.project.name}.png`) });
});

test("開く操作で書き込み許可を得て、最初の編集から自動保存する", async ({ app }) => {
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const original = target.showOpenFilePicker!;
    Object.defineProperty(target, "showOpenFilePicker", { value: async (options: unknown) => {
      if (Reflect.get(options as object, "mode") !== "readwrite") throw new Error("読み書き指定が必要です");
      const handles = await original();
      let granted = false;
      Object.defineProperties(handles[0], {
        queryPermission: { value: async ({ mode }: { mode: string }) => mode === "read" || granted ? "granted" : "prompt" },
        requestPermission: { value: async () => { granted = true; return "granted"; } },
      });
      return handles;
    } });
  });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  await app.getByRole("textbox", { name: "科目コード", exact: true }).fill("100");
  await app.getByRole("textbox", { name: "科目名", exact: true }).fill("権限テスト");
  await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption("sales");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "権限テストを編集", exact: true }).click();
  await app.getByRole("textbox", { name: "権限テストの科目コード", exact: true }).fill("101");
  await expect(app.getByRole("button", { name: "完了", exact: true })).toBeEnabled();
  await expect(app.getByRole("alert")).toHaveCount(0);
  await app.getByRole("button", { name: "完了", exact: true }).click();
  await expect(app.getByRole("cell", { name: "101", exact: true })).toBeVisible();
});


test("書き込み許可を拒否したときは編集を開始せず、選び直して保存できる", async ({ page, app }) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("permission-denied");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("読み書きが許可されませんでした");
  await expect(app.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Home", exact: true })).toHaveCount(0);
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("write-permission");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await expect(app.getByRole("alert")).toHaveCount(0);
});
