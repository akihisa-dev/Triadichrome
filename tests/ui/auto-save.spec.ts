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
  await app.getByRole("textbox", { name: "名称", exact: true }).fill("売上高");
  await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption("sales");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await openInitiativeEntry(app);
  await selectClassification(app.getByRole("spinbutton", { name: "展開名", exact: true }), "コスト");
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("保存する施策");
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).focus();
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
  const list = app.getByRole("table", { name: "施策一覧", exact: true });
  await expect(list.locator('thead th[scope="colgroup"]').first()).toHaveText("4月");
  await expect(list.locator("thead tr").nth(1).getByRole("columnheader").first()).toHaveText("売上");
  const savedRow = list.getByRole("row").filter({ has: app.getByRole("button", { name: "保存する施策", exact: true }) });
  await expect(savedRow.locator(".initiative-list-expansion")).toHaveText("コスト");
  await expect(savedRow.locator("td:not(.initiative-list-fixed)").first()).toHaveText("126");
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
  await app.getByRole("textbox", { name: "名称", exact: true }).fill("権限テスト");
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

test("既存の全月0行を空欄・未選択に戻すと再表示で旧科目が残らない", async ({ app, page }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("full");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
  await app.getByRole("tab", { name: "一次予算", exact: true }).click();
  for (const month of [4,5,6,7,8,9,10,11,12,1,2,3]) {
    const input = app.getByRole("spinbutton", { name: `未所属費用 ${month}月の金額`, exact: true });
    await input.press("F2");
    await input.fill("");
  }
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).focus();
  await app.getByRole("combobox", { name: "1行目の勘定科目", exact: true }).selectOption("");
  const back = app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true });
  await expect(back).toBeEnabled();
  await expect(app.getByRole("alert")).toHaveCount(0);
  await back.click();
  await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
  await expect(app.getByRole("combobox", { name: "1行目の勘定科目", exact: true })).toHaveValue("1");
  await expect(app.getByRole("combobox", { name: "2行目の勘定科目", exact: true })).toHaveCount(0);
});


test("0化が保存されるまで科目変更・削除を待ち、保存後に削除できる", async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("full");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
  const amount = app.getByRole("spinbutton", { name: "未所属費用 4月の金額", exact: true });
  const account = app.getByRole("combobox", { name: "1行目の勘定科目", exact: true });
  const remove = app.getByRole("button", { name: "1行目を削除", exact: true });
  await amount.fill("100");
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await amount.fill("0");
  await expect(account).toBeDisabled();
  await expect(remove).toBeDisabled();
  await expect(remove).toBeEnabled();
  await expect(account).toBeEnabled();
  await remove.click();
  await expect(app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true })).toBeEnabled();
  await expect(app.getByRole("alert")).toHaveCount(0);
  await app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click();
  await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
  await expect(app.getByRole("spinbutton", { name: "未所属費用 4月の金額", exact: true })).toHaveCount(0);
});


test("合計エラーと保存失敗が重ならず入力を取り消せる", async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("full");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
  const amount = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  await amount.click();
  await settleMotion(app.locator("body"));
  const originalBounds = await amount.boundingBox();
  await amount.fill("0.0001");
  const cancel = app.getByRole("button", { name: "入力を取り消す", exact: true });
  await expect(cancel).toBeVisible();
  await expect(app.getByRole("alert")).toHaveCount(2);
  await settleMotion(app.locator("#status-notice-layer"));
  const boxes = await app.locator(".status-notice").evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  }));
  expect(boxes).toHaveLength(2);
  expect(boxes[0]!.bottom).toBeLessThanOrEqual(boxes[1]!.top);
  expect(await amount.boundingBox()).toEqual(originalBounds);
  await cancel.click();
  await expect(amount).toHaveValue("0");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await amount.fill("0.0001");
  await expect(cancel).toBeVisible();
  await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
  await expect(amount).toHaveValue("0.0001");
  await amount.fill("1.125");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await expect(amount).toHaveValue("1.125");
});

for (const [kind, operation, failure] of [
  ["一次予算", "削除", false], ["一次予算", "科目変更", true],
  ["確定予算", "削除", true], ["確定予算", "科目変更", false],
] as const) {
  test(`非0の保存確定前に0へ戻しても${kind}の${operation}を待機し、${failure ? "失敗後の再試行" : "連続入力"}を保持する`, async ({ page, app }) => {
    await page.getByLabel("テストデータ", { exact: true }).selectOption("full");
    await expect(page.getByRole("status")).toHaveText("操作できます");
    await app.locator("body").evaluate(() => {
      const target = window as Window & {
        showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
        saveStarted?: boolean; releaseSave?: (fail: boolean) => void;
      };
      const picker = target.showOpenFilePicker!;
      Object.defineProperty(target, "showOpenFilePicker", { value: async () => {
        const handles = await picker();
        const handle = handles[0]!;
        const create = handle.createWritable.bind(handle);
        let hold = true;
        Object.defineProperty(handle, "createWritable", { value: async () => {
          const writable = await create();
          const close = writable.close.bind(writable);
          writable.close = async () => {
            if (hold) {
              hold = false;
              target.saveStarted = true;
              await new Promise<void>((resolve, reject) => {
                target.releaseSave = fail => fail ? reject(new Error("制御した保存失敗")) : resolve();
              });
            }
            await close();
          };
          return writable;
        } });
        return handles;
      } });
    });
    await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    await app.getByRole("button", { name: "サイドバーを開く", exact: true }).click();
    await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
    await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
    await app.getByRole("tab", { name: kind, exact: true }).click();
    const amount = app.getByRole("spinbutton", { name: "未所属費用 4月の金額", exact: true });
    const account = app.getByRole("combobox", { name: "1行目の勘定科目", exact: true });
    const remove = app.getByRole("button", { name: "1行目を削除", exact: true });
    const back = app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true });
    await amount.fill("100");
    await expect.poll(() => app.locator("body").evaluate(() => Boolean(Reflect.get(window, "saveStarted")))).toBe(true);
    await amount.fill("0");
    await expect(account).toBeDisabled();
    await expect(remove).toBeDisabled();
    const extra = app.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true });
    await extra.fill("8");
    await extra.fill("9");
    await app.getByRole("textbox", { name: "備考", exact: true }).fill("確定待ちの最新入力");
    await app.locator("body").evaluate((_node, fail) => Reflect.get(window, "releaseSave")(fail), failure);
    if (failure) {
      await expect(app.getByRole("alert")).toContainText("制御した保存失敗");
      await expect(amount).toHaveValue("0");
      await expect(extra).toHaveValue("9");
      await app.getByRole("button", { name: "保存を再試行", exact: true }).click();
    }
    await expect(back).toBeEnabled();
    await expect(account).toBeEnabled();
    await expect(remove).toBeEnabled();
    if (operation === "削除") await remove.click();
    else { await account.focus(); await account.selectOption({ label: "537 旅費" }); }
    await expect(back).toBeEnabled();
    await expect(app.getByRole("alert")).toHaveCount(0);
    await back.click();
    await app.getByRole("button", { name: "科目変更と削除の確認", exact: true }).click();
    await app.getByRole("tab", { name: kind, exact: true }).click();
    await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("確定待ちの最新入力");
    await expect(extra).toHaveValue("9");
    if (operation === "削除") await expect(app.getByRole("button", { name: "2行目を削除", exact: true })).toHaveCount(0);
    else await expect(app.getByRole("spinbutton", { name: "旅費 4月の金額", exact: true })).toHaveValue("0");
  });
}
