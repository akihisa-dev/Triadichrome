import { test, expect, attachImage, settleMotion } from "./fixtures";
import { installMemoryFiles } from "./memory-files";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { type FrameLocator, type Page } from "@playwright/test";

async function prepareAccountRows(target: FrameLocator | Page) {
  await target.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "マスタ", exact: true }).click();
  await target.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  for (const [code, name] of [["100", "売上高"], ["501", "消耗品費"], ["600", "給与手当"]] as const) {
    await target.getByRole("textbox", { name: "科目コード", exact: true }).fill(code);
    await target.getByRole("textbox", { name: "科目名", exact: true }).fill(name);
    await target.getByRole("combobox", { name: "科目属性", exact: true }).selectOption("expense");
    await target.getByRole("button", { name: "登録", exact: true }).click();
    await expect(target.getByRole("button", { name: `${name}を編集`, exact: true })).toBeVisible();
  }
  await target.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策入力", exact: true }).click();
  await target.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await target.getByRole("combobox", { name: "業種名", exact: true }).selectOption("1");
  await target.getByRole("combobox", { name: "部署名", exact: true }).selectOption("1");
  for (const [index, name] of ["100 売上高", "501 消耗品費", "600 給与手当"].entries()) {
    if (index > 0) await target.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
    await target.getByRole("combobox", { name: `${index + 1}行目の勘定科目` }).selectOption({ label: name });
  }
}

test("ファイルを開き、サイドバーを操作して入口へ戻る", async ({ page, app }, testInfo) => {
  const preview = page.locator("#app-preview");
  await attachImage(testInfo, "入口", await preview.screenshot());
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button", { name: /サイドバー/ });
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const main = app.getByRole("main", { name: "ホーム", exact: true });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
  await settleMotion(app.locator("body"));
  const fullMain = (await main.boundingBox())!;
  await attachImage(testInfo, "ホーム", await preview.screenshot());

  await trigger.click();
  const close = sidebar.getByRole("button", { name: "サイドバーを閉じる" });
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleName("サイドバーを閉じる");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await settleMotion(app.locator("body"));
  const sidebarBox = (await sidebar.boundingBox())!;
  const mainBox = (await main.boundingBox())!;
  expect(mainBox.x).toBeCloseTo(sidebarBox.x + sidebarBox.width);
  expect(mainBox.width).toBeCloseTo(fullMain.width + 64 - sidebarBox.width);
  expect(mainBox.width).toBeGreaterThan(0);
  expect(mainBox.y).toBe(fullMain.y);
  await expect(app.getByRole("dialog")).toHaveCount(0);
  await attachImage(testInfo, "サイドバー", await preview.screenshot());
  await page.keyboard.press("Tab");
  await expect(app.getByRole("button", { name: "修正予算を開始", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleName("サイドバーを開く");
  await settleMotion(app.locator("body"));
  expect(await main.boundingBox()).toEqual(fullMain);
  await expect(app.getByRole("navigation")).toHaveCount(1);

  await trigger.click();
  await close.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await main.click({ position: { x: 20, y: 20 } });
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await settleMotion(app.locator("body"));
  expect(await main.boundingBox()).toEqual(fullMain);

  await trigger.click();
  await sidebar.getByRole("button", { name: "ファイルを閉じる" }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("サイドバーを開いたまま施策入力とホームを往復できる", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button", { name: /サイドバー/ });
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const navigation = sidebar.getByRole("navigation", { name: "メインナビゲーション" });
  const home = navigation.getByRole("button", { name: "Home", exact: true });
  const initiativeEntry = navigation.getByRole("button", { name: "施策入力", exact: true });

  await trigger.click();
  await expect(navigation.getByRole("button")).toHaveText(["Home", "前年入力", "施策入力", "施策一覧", "総原価表", "展開表", "明細", "マスタ"]);
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(initiativeEntry).not.toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  await expect(app.getByRole("button", { name: "修正予算を開始", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "サイドバーを閉じる" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(home).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button", { name: "前年入力", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(initiativeEntry).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(sidebar).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(initiativeEntry).toBeFocused();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toHaveCount(0);
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);

  await expect(initiativeEntry).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current", "page");
  await app.getByRole("heading", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "業種名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "部署名", exact: true }).selectOption("1");
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
  await trigger.click();
  await home.click();
  await expect(sidebar).toBeVisible();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  await expect(app.getByRole("main", { name: "施策入力", exact: true })).toHaveCount(0);

  await expect(home).toHaveAttribute("aria-current", "page");
  await initiativeEntry.click();
  await sidebar.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
});

test("施策名・備考・月別金額を入力し、画面を往復しても保持する", async ({ page, app }, testInfo) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button", { name: /サイドバー/ });
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  const name = app.getByRole("textbox", { name: "施策名", exact: true });
  const note = app.getByRole("textbox", { name: "備考", exact: true });
  const sales = app.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  const salaries = app.getByRole("spinbutton", { name: "給与手当 3月の金額", exact: true });
  await trigger.click();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();
  await prepareAccountRows(app);
  await expect(name).toBeVisible();
  await expect(name).toHaveValue("");
  await trigger.click();
  await name.focus();
  await expect(name).toBeFocused();
  await name.fill("業務改善施策");
  await expect(name).toHaveValue("業務改善施策");
  await name.fill("");
  await expect(name).toHaveValue("");
  await name.fill("業務改善施策（改訂）");
  await expect(note).toHaveAttribute("type", "text");
  await note.fill("上期の業務改善・担当部門と実施時期を調整する");
  await sales.fill("100");
  await salaries.fill("300");
  await trigger.click();
  await expect(name).toHaveValue("業務改善施策（改訂）");
  await sidebar.getByRole("button", { name: "Home", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();
  await expect(name).toHaveValue("業務改善施策（改訂）");
  await trigger.click();
  await expect(note).toHaveValue("上期の業務改善・担当部門と実施時期を調整する");
  await expect(sales).toHaveValue("100");
  await expect(salaries).toHaveValue("300");
  await app.getByText("施策名", { exact: true }).click();
  await expect(name).toBeFocused();
  await settleMotion(app.locator("body"));
  const titleBox = (await app.getByRole("heading", { name: "施策入力", exact: true }).boundingBox())!;
  const nameBox = (await name.boundingBox())!;
  expect(nameBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  expect(nameBox.x).toBe(titleBox.x);
  const registerBox = (await app.getByRole("button", { name: "登録", exact: true }).boundingBox())!;
  expect(registerBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
  expect(registerBox.y).toBe(nameBox.y);
  expect(registerBox.height).toBe(nameBox.height);
  const noteBox = (await note.boundingBox())!;
  expect(noteBox.height).toBe(nameBox.height);
  const tableBox = (await app.locator("#kind-amount-panel").boundingBox())!;
  expect(noteBox.y).toBeGreaterThan(nameBox.y + nameBox.height);
  expect(tableBox.y).toBeGreaterThan(noteBox.y + noteBox.height);
  expect(noteBox.x).toBe(nameBox.x);
  expect(tableBox.x).toBe(nameBox.x);
  await attachImage(testInfo, "施策入力・備考と月別金額", await page.locator("#app-preview").screenshot());

  await trigger.click();
  await sidebar.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await trigger.click();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();
  await expect(name).toHaveValue("");
  await expect(note).toHaveValue("");
  expect(await app.getByRole("table", { name: "月別計画金額", exact: true }).getByRole("spinbutton").evaluateAll(inputs => inputs.every(input => (input as HTMLInputElement).value === "0"))).toBe(true);
});

test("金額表の各セルを編集でき、狭い画面でも最後の月に入力できる", async ({ page, app }, testInfo) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button", { name: /サイドバー/ });
  await trigger.click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策入力", exact: true }).click();
  await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "業種名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "部署名", exact: true }).selectOption("1");
  await prepareAccountRows(app);
  await trigger.click();
  const table = app.getByRole("table", { name: "月別計画金額", exact: true });
  const region = app.locator("#kind-amount-panel");
  await expect(table.getByRole("columnheader")).toHaveText(["勘定科目", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"]);
  expect(await table.getByRole("combobox").evaluateAll(inputs => inputs.map(input => (input as HTMLSelectElement).selectedOptions[0]?.textContent))).toEqual(["100 売上高", "501 消耗品費", "600 給与手当"]);
  await expect(table.getByRole("spinbutton")).toHaveCount(36);
  expect(await table.getByRole("spinbutton").evaluateAll(inputs => inputs.every(input => (input as HTMLInputElement).value === "0"))).toBe(true);

  const aprilSales = table.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true });
  const maySales = table.getByRole("spinbutton", { name: "売上高 5月の金額", exact: true });
  const supplies = table.getByRole("spinbutton", { name: "消耗品費 4月の金額", exact: true });
  const salaries = table.getByRole("spinbutton", { name: "給与手当 3月の金額", exact: true });
  const decemberSales = table.getByRole("spinbutton", { name: "売上高 12月の金額", exact: true });
  const januarySales = table.getByRole("spinbutton", { name: "売上高 1月の金額", exact: true });
  await aprilSales.fill("0");
  await aprilSales.press("Tab");
  await expect(maySales).toBeFocused();
  await maySales.pressSequentially("12.5");
  await maySales.press("Shift+Tab");
  await expect(aprilSales).toBeFocused();
  await decemberSales.fill("1200");
  await decemberSales.press("Tab");
  await expect(januarySales).toBeFocused();
  await januarySales.fill("1300");
  await supplies.fill("-25.5");
  expect(await supplies.evaluate(input => (input as HTMLInputElement).validity.valid)).toBe(true);
  await salaries.fill("300");
  await expect(aprilSales).toHaveValue("0");
  await expect(maySales).toHaveValue("12.5");
  await expect(supplies).toHaveValue("-25.5");
  await expect(salaries).toHaveValue("300");
  await expect(decemberSales).toHaveValue("1200");
  await expect(januarySales).toHaveValue("1300");
  await expect(table.getByRole("spinbutton", { name: "売上高 3月の金額", exact: true })).toHaveValue("0");
  await supplies.fill("");
  await expect(supplies).toHaveValue("");
  await expect(aprilSales).toHaveValue("0");

  await settleMotion(app.locator("body"));
  const header = table.getByRole("rowheader").nth(2);
  const headerBefore = (await header.boundingBox())!;
  await salaries.focus();
  const headerAfter = (await header.boundingBox())!;
  const regionBox = (await region.boundingBox())!;
  const lastCellBox = (await salaries.boundingBox())!;
  if (testInfo.project.name !== "narrow") {
    expect(headerAfter.x).toBe(headerBefore.x);
    expect(headerAfter.x).toBeCloseTo(regionBox.x);
  }
  expect(lastCellBox.x + lastCellBox.width).toBeLessThanOrEqual(regionBox.x + regionBox.width);
  if (testInfo.project.name === "narrow") {
    expect(await region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  }
  expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await attachImage(testInfo, "月別金額・最後の月を編集", await page.locator("#app-preview").screenshot());
});

test("画面幅を変えてもサイドバーとメインが並び、閉じると幅が戻る", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const trigger = app.locator(".home-header").getByRole("button", { name: /サイドバー/ });
  const sidebar = app.getByRole("complementary", { name: "メニュー" });
  await trigger.click();
  await sidebar.getByRole("button", { name: "施策入力", exact: true }).click();

  for (const width of [320, 600, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(sidebar).toBeVisible();
    await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
    await settleMotion(app.locator("body"));
    const frame = (await page.locator("#app-preview").boundingBox())!;
    const sidebarBox = (await sidebar.boundingBox())!;
    const mainBox = (await app.getByRole("main", { name: "施策入力", exact: true }).boundingBox())!;
    expect(sidebarBox.x).toBe(frame.x);
    expect(mainBox.x).toBeCloseTo(sidebarBox.x + sidebarBox.width);
    expect(mainBox.x + mainBox.width).toBeCloseTo(frame.x + frame.width);
    expect(mainBox.width).toBeGreaterThanOrEqual(frame.width / 2);
    const nameBox = (await app.getByRole("textbox", { name: "施策名", exact: true }).boundingBox())!;
    expect(nameBox.x).toBeGreaterThanOrEqual(mainBox.x);
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width);
    const registerBox = (await app.getByRole("button", { name: "登録", exact: true }).boundingBox())!;
    expect(registerBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
    expect(registerBox.y).toBe(nameBox.y);
    expect(registerBox.x + registerBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width);
    const tableBox = (await app.locator("#kind-amount-panel").boundingBox())!;
    expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width);
    expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await app.getByRole("heading", { name: "施策入力", exact: true }).click();
    await app.getByRole("combobox", { name: "展開名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "業種名", exact: true }).selectOption("1");
  await app.getByRole("combobox", { name: "部署名", exact: true }).selectOption("1");
    await expect(sidebar).toBeVisible();
  }

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeVisible();
  await settleMotion(app.locator("body"));
  const mainBox = (await app.getByRole("main", { name: "施策入力", exact: true }).boundingBox())!;
  const frame = (await page.locator("#app-preview").boundingBox())!;
  expect(mainBox.x).toBe(frame.x + 64);
  expect(mainBox.width).toBe(frame.width - 64);
});

test("新しい計画の年度を一度選び、閉じた後に同じ年度で読み直せる", async ({ app }) => {
  const year = app.getByRole("spinbutton", { name: "年度", exact: true });
  await year.press("ArrowDown");
  while (await year.getAttribute("aria-valuenow") !== "2030") {
    const current = Number(await year.getAttribute("aria-valuenow"));
    await year.press(current < 2030 ? "ArrowDown" : "ArrowUp");
  }
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.locator(".home-header")).toContainText("2030年度");
  await expect(app.locator(".home-file-name")).toHaveText("Untitled.triadic");
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "ファイルを閉じる" }).click();
  await app.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.locator(".home-file-name")).toHaveText("Untitled.triadic");
  await expect(app.locator(".home-header")).toContainText("2030年度");
});

test("選択・新規作成のキャンセル後も入口を操作できる", async ({ page, app }) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("cancel");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  for (const name of ["ファイルを開く", "新規作成"]) {
    await app.getByRole("button", { name, exact: true }).click();
    await expect(app.getByRole("button", { name, exact: true })).toBeEnabled();
    await expect(app.getByRole("alert")).toHaveCount(0);
    await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  }
});

test("壊れたファイルを拒否し、正常なファイルで再開できる", async ({ page, app }, testInfo) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("invalid");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("Triadicファイルを読み込めませんでした。");
  await expect(app.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
  await settleMotion(app.locator("body"));
  await attachImage(testInfo, "不正ファイル", await page.locator("#app-preview").screenshot());
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("normal");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
});

test("保存失敗時は入口に残り、既存の計画を開ける", async ({ page, app }) => {
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.locator(".home-file-name")).toHaveText("画面テスト.triadic");
});

test("確認用画面と配布用ビルドの表示・操作が一致する", async ({ page, app, context }, testInfo) => {
  const production = await context.newPage();
  const errors: string[] = [];
  production.on("pageerror", error => errors.push(error.message));
  production.on("console", message => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  try {
    const bounds = (await page.locator("#app-preview").boundingBox())!;
    await production.setViewportSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
    const bytes = await page.evaluate(async path => (await import(path)).fixtureBytes as number[], "/tests/ui/preview.ts");
    await production.goto("/Triadichrome-extension/index.html");
    await production.evaluate(installMemoryFiles, { bytes, scenario: "normal" as const });
    await expect(production).toHaveTitle("Triadichrome");
    await expect(production.getByRole("heading", { name: "Triadichrome" })).toBeVisible();
    for (const state of ["入口", "ホーム", "サイドバー", "施策入力"] as const) {
      if (state !== "入口") {
        const name = state === "ホーム" ? "ファイルを開く" : state === "サイドバー" ? "サイドバーを開く" : "施策入力";
        const previewTarget = state === "施策入力" ? app.getByRole("complementary", { name: "メニュー" }) : app;
        const productionTarget = state === "施策入力" ? production.getByRole("complementary", { name: "メニュー" }) : production;
        await previewTarget.getByRole("button", { name, exact: true }).click();
        await productionTarget.getByRole("button", { name, exact: true }).click();
      }
      if (state === "ホーム") {
        await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
        await expect(production.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
      }
      if (state === "施策入力") {
        for (const target of [app, production]) {
          await prepareAccountRows(target);
          await target.getByRole("textbox", { name: "施策名", exact: true }).fill("業務改善施策");
          await target.getByRole("textbox", { name: "備考", exact: true }).fill("上期に実施\n関係部門と調整");
          await target.getByRole("spinbutton", { name: "売上高 4月の金額", exact: true }).fill("100");
          await target.getByRole("button", { name: "サイドバーを閉じる", exact: true }).first().click();
          await target.getByRole("heading", { name: "施策入力", exact: true }).click();
        }
      }
      await settleMotion(app.locator("body"));
      await settleMotion(production.locator("body"));
      if (state === "施策入力") {
        // Filling a lower row can scroll an iframe and a top-level page by
        // different amounts. Compare the same explicit viewing position.
        for (const target of [app, production]) {
          await target.locator(".home-content").evaluate(node => node.scrollTo(0, 0));
          await target.locator(".initiative-amount-table-container").evaluate(node => node.scrollTo(0, 0));
        }
      }
      await expect(app.locator("img")).toHaveCount(1);
      await expect.poll(() => app.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      await expect.poll(() => production.locator("img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      expect(await app.locator("body").ariaSnapshot()).toBe(await production.locator("body").ariaSnapshot());
      await page.mouse.move(0, 0);
      await production.mouse.move(0, 0);
      const previewImage = await page.locator("#app-preview").screenshot();
      const productionImage = await production.screenshot();
      await attachImage(testInfo, `${state}・確認用`, previewImage);
      await attachImage(testInfo, `${state}・配布用`, productionImage);
      const reference = PNG.sync.read(previewImage);
      const actual = PNG.sync.read(productionImage);
      expect({ width: actual.width, height: actual.height }).toEqual({ width: reference.width, height: reference.height });
      const difference = new PNG({ width: reference.width, height: reference.height });
      // Nested and top-level pages can rasterize text edges differently. Ignore
      // anti-aliasing, including translucent disabled text; require zero other differences.
      const differentPixels = pixelmatch(reference.data, actual.data, difference.data, reference.width, reference.height, { threshold: 0.2 });
      if (differentPixels > 0) await attachImage(testInfo, `${state}・差分`, PNG.sync.write(difference));
      expect(differentPixels, `${state}の表示が配布用ビルドと一致する`).toBe(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await production.close();
  }
});

for (const [date, year] of [["2027-03-31T12:00:00+09:00", 2026], ["2027-04-01T12:00:00+09:00", 2027]] as const) {
  test(`年度スロットの初期値は4月始まりの当年度: ${date}`, async ({ page, app }) => {
    await page.clock.install({ time: new Date(date) });
    await page.reload();
    const slot = app.getByRole("spinbutton", { name: "年度", exact: true });
    await expect(slot).toHaveAttribute("aria-valuenow", String(year));
    await slot.press("ArrowDown");
    await expect(slot).toHaveAttribute("aria-valuenow", String(year + 1));
    await slot.press("ArrowUp");
    await expect(slot).toHaveAttribute("aria-valuenow", String(year));
    await slot.hover();
    await page.mouse.wheel(0, 60);
    await expect(slot).toHaveAttribute("aria-valuenow", String(year + 1));
    await app.getByRole("button", { name: "当年度", exact: true }).click();
    await expect(slot).toHaveAttribute("aria-valuenow", String(year));
    await app.getByRole("button", { name: "次の年度", exact: true }).click();
    await expect(slot).toHaveAttribute("aria-valuenow", String(year + 1));
    await app.getByRole("button", { name: "新規作成", exact: true }).click();
    await expect(app.locator(".home-header")).toContainText(`${year + 1}年度`);
  });
}

test("年度スロットをドラッグして選び、ページの位置を保つ", async ({ page, app }) => {
  const slot = app.getByRole("spinbutton", { name: "年度", exact: true });
  const year = Number(await slot.getAttribute("aria-valuenow"));
  const selected = await app.locator(".year-slot-selected").boundingBox();
  if (!selected) throw new Error("年度スロットが表示されていません。");
  const position = await slot.boundingBox();
  await page.mouse.move(selected.x + selected.width / 2, selected.y + selected.height / 2);
  await page.mouse.down();
  await page.mouse.move(selected.x + selected.width / 2, selected.y + selected.height / 2 - 28);
  await page.mouse.up();
  await expect(slot).toHaveAttribute("aria-valuenow", String(year + 1));
  expect(await slot.boundingBox()).toEqual(position);
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.locator(".home-header")).toContainText(`${year + 1}年度`);
});
