import { test, expect, settleMotion } from "./fixtures";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FrameLocator } from "@playwright/test";

async function openMaster(app: FrameLocator) {
  await app.getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
}

async function addAccount(app: FrameLocator, code: string, name: string, attribute: string) {
  await app.getByRole("textbox", { name: "科目コード", exact: true }).fill(code);
  await app.getByRole("textbox", { name: "科目名", exact: true }).fill(name);
  await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption(attribute);
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("button", { name: `${name}を編集`, exact: true })).toBeVisible();
}

test("一覧の施策名から該当年度の詳細を開き、新規入力を保持して戻れる", async ({ app, page }, testInfo) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await openMaster(app);
  await addAccount(app, "100", "売上高", "sales");
  for (const [name, year, amount] of [["施策A", "2026", "100"], ["施策B", "2027", "200"]]) {
    await app.getByRole("button", { name: "施策入力", exact: true }).click();
    await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
    await app.getByRole("textbox", { name: "施策名", exact: true }).fill(name!);
    await app.getByRole("textbox", { name: "備考", exact: true }).fill(`${name}の備考`);
    await app.getByRole("spinbutton", { name: "年度", exact: true }).fill(year!);
    await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "100 売上高" });
    await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill(amount!);
    await app.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true }).fill("0");
    await app.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
    await app.getByRole("combobox", { name: "2行目の勘定科目" }).selectOption({ label: "100 売上高" });
    await app.getByRole("spinbutton", { name: "売上高 3月の金額", exact: true }).nth(1).fill("25.5");
    await app.getByRole("button", { name: "登録", exact: true }).click();
    await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  }
  await app.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("作成中の施策");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("入力を保持");
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "100 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("300");
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("combobox", { name: "年度", exact: true }).selectOption("2026");
  await app.getByRole("button", { name: "施策A", exact: true }).click();
  await expect(app.getByRole("heading", { name: "施策詳細", exact: true })).toBeVisible();
  await expect(app.getByRole("button", { name: "施策一覧", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("施策A");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("施策Aの備考");
  await expect(app.getByRole("spinbutton", { name: "年度", exact: true })).toHaveValue("2026");
  const table = app.getByRole("table", { name: "月別計画金額", exact: true });
  await expect(table.getByRole("combobox")).toHaveCount(2);
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).first()).toHaveValue("100");
  await expect(app.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true }).first()).toHaveValue("0");
  await expect(app.getByRole("spinbutton", { name: "売上高 6月の金額", exact: true }).first()).toHaveValue("0");
  await expect(app.getByRole("spinbutton", { name: "売上高 3月の金額", exact: true }).nth(1)).toHaveValue("25.5");
  expect(await app.getByRole("main").locator("input").evaluateAll(inputs => inputs.every(input => input instanceof HTMLInputElement && !input.readOnly))).toBe(true);
  await expect(app.getByRole("button", { name: "登録", exact: true })).toHaveCount(0);
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: join(tmpdir(), `triadichrome-detail-${testInfo.project.name}.png`) });
  await app.getByRole("button", { name: "← 施策一覧へ戻る", exact: true }).click();
  await expect(app.getByRole("combobox", { name: "年度", exact: true })).toHaveValue("2026");
  await app.getByRole("combobox", { name: "年度", exact: true }).selectOption("2027");
  await app.getByRole("button", { name: "施策B", exact: true }).press("Enter");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("施策B");
  await expect(app.getByRole("spinbutton", { name: "年度", exact: true })).toHaveValue("2027");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).first()).toHaveValue("200");
  await app.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("作成中の施策");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("入力を保持");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true })).toHaveValue("300");
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("button", { name: "施策A", exact: true }).click();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("施策A");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).first()).toHaveValue("100");
});

test("属性別に集計した施策を一覧で表示し、年度切替・属性変更・再読込に反映する", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.getByText("この年度の施策はまだ登録されていません。")).toBeVisible();
  await openMaster(app);
  for (const [code, name, type] of [["100", "売上高", "sales"], ["200", "売上原価", "cost"], ["500", "費用", "expense"], ["900", "利益", "profit"]] as const) await addAccount(app, code, name, type);
  await app.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("施策A");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("登録時の備考");
  await app.getByRole("spinbutton", { name: "年度", exact: true }).fill("2026");
  for (const [index, [name, amount]] of [["100 売上高", "1000"], ["200 売上原価", "200"], ["500 費用", "100"], ["900 利益", "50"], ["100 売上高", "25.5"]].entries()) {
    if (index) await app.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
    await app.getByRole("combobox", { name: `${index + 1}行目の勘定科目` }).selectOption({ label: name! });
    await app.getByRole("table", { name: "月別計画金額", exact: true }).getByRole("row").nth(index + 1).getByRole("spinbutton").nth(0).fill(amount!);
  }
  await app.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true }).first().fill("0");
  await app.getByRole("spinbutton", { name: "売上高 3月の金額", exact: true }).first().fill("300");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  const list = app.getByRole("table", { name: "施策一覧", exact: true });
  const row = list.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "施策A", exact: true }) });
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(app.getByRole("button", { name: "施策一覧", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(row.getByRole("cell").nth(0)).toHaveText("826");
  await expect(row.getByRole("cell").nth(1)).toHaveText("776");
  await expect(row.getByRole("cell").nth(2)).toHaveText("0");
  await expect(row.getByRole("cell").nth(4)).toHaveText("0");
  await expect(row.getByRole("cell").nth(23)).toHaveText("300");
  await expect(row.getByRole("rowheader")).toHaveAttribute("title", "登録時の備考");
  await app.locator(".home-header button").click();
  const region = app.getByRole("region", { name: "施策一覧の月別売上・利益" });
  await settleMotion(app.locator("body"));
  const before = (await row.getByRole("rowheader").boundingBox())!;
  await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  const after = (await row.getByRole("rowheader").boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `triadichrome-list-${test.info().project.name}.png`) });
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("施策B");
  await app.getByRole("spinbutton", { name: "年度", exact: true }).fill("2027");
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "100 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("10");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(list.getByRole("rowheader")).toHaveText("施策B");
  await app.getByRole("combobox", { name: "年度", exact: true }).selectOption("2026");
  await expect(list.getByRole("rowheader")).toHaveText("施策A");
  await openMaster(app);
  await expect(app.getByRole("button", { name: "売上高を削除", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "費用を編集", exact: true }).click();
  await app.getByRole("combobox", { name: "費用の科目属性", exact: true }).selectOption("profit");
  await app.getByRole("button", { name: "完了", exact: true }).click();
  await expect(app.getByRole("button", { name: "費用を編集", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(row.getByRole("cell").nth(1)).toHaveText("976");
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await app.getByRole("combobox", { name: "年度", exact: true }).selectOption("2026");
  await expect(row.getByRole("cell").nth(1)).toHaveText("976");
  await expect(row.getByRole("rowheader")).toHaveAttribute("title", "登録時の備考");
});

test("施策保存の失敗で入力と保存済み一覧を保持する", async ({ app }) => {
  // Keep the real file handle used by the app and fail only its second write.
  await app.locator("body").evaluate(() => {
    const target = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    const originalPicker = target.showOpenFilePicker!;
    Object.defineProperty(target, "showOpenFilePicker", { value: async () => {
      const handles = await originalPicker();
      const handle = handles[0]!;
      const createWritable = handle.createWritable.bind(handle);
      let writes = 0;
      Object.defineProperty(handle, "createWritable", { value: async () => {
        if (++writes > 1) throw new Error("テスト用の施策保存失敗");
        return createWritable();
      } });
      return handles;
    } });
  });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await openMaster(app);
  await addAccount(app, "100", "売上高", "sales");
  await app.getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("textbox", { name: "施策名", exact: true }).fill("保存失敗でも残す施策");
  await app.getByRole("textbox", { name: "備考", exact: true }).fill("備考も残す");
  await app.getByRole("combobox", { name: "1行目の勘定科目" }).selectOption({ label: "100 売上高" });
  await app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("123.5");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の施策保存失敗");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("保存失敗でも残す施策");
  await expect(app.getByRole("textbox", { name: "備考", exact: true })).toHaveValue("備考も残す");
  await expect(app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true })).toHaveValue("123.5");
  await app.getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.getByText("この年度の施策はまだ登録されていません。")).toBeVisible();
});
