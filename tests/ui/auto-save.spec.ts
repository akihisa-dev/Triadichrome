import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, settleMotion } from "./fixtures";

test("更新を自動保存して再読込でき、失敗・入力不備で入力を残せる", async ({ app, page }, testInfo) => {
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const original = target.showOpenFilePicker!;
    let writes = 0;
    Object.defineProperty(target, "showOpenFilePicker", { value: async () => {
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
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("保存する施策");
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption("1");
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("100");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await app.getByRole("button", { name: "保存する施策", exact: true }).click();
  const amount = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  await amount.fill("125.5");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await expect(amount).toBeFocused();
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("失敗しても残す備考");
  await expect(app.getByRole("alert")).toContainText("自動保存のテスト失敗");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("失敗しても残す備考");
  await expect(app.getByRole("button", { name: "ファイルを閉じる", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("");
  await expect(app.getByRole("alert")).toContainText("施策名を入力");
  await app.getByRole("button", { name: "未保存の変更を戻す", exact: true }).click();
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

test("自動保存で権限を勝手に要求せず、再試行の操作から許可を得る", async ({ app }) => {
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const original = target.showOpenFilePicker!;
    Object.defineProperty(target, "showOpenFilePicker", { value: async () => {
      const handles = await original();
      let granted = false;
      Object.defineProperties(handles[0], {
        queryPermission: { value: async () => granted ? "granted" : "prompt" },
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
  await expect(app.getByRole("alert")).toContainText("ファイルへの保存を許可");
  await expect(app.getByRole("button", { name: "完了", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await app.getByRole("button", { name: "完了", exact: true }).click();
  await expect(app.getByRole("cell", { name: "101", exact: true })).toBeVisible();
});
