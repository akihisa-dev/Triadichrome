import { openInitiativeEntry, test, expect, settleMotion, attachImage, selectClassification } from "./fixtures";
import { installMemoryFiles } from "./memory-files";
import type { FrameLocator, Locator } from "@playwright/test";

const blue = "rgb(0, 51, 255)";
const ink = "rgb(32, 32, 32)";
const soft = "rgb(242, 242, 242)";
const routes = ["Home", "前年入力", "施策一覧", "総原価表", "展開表", "マスタ"];

async function navigate(app: FrameLocator, name: string) {
  if (name === "施策入力") await openInitiativeEntry(app);
  else await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name, exact: true }).click();
  await expect(app.getByRole("heading", { name, exact: true })).toBeVisible();
  await settleMotion(app.locator("body"));
}

async function expectEditingColor(input: Locator) {
  await input.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-color", blue);
  await expect(input).toHaveCSS("caret-color", blue);
  await expect(input).toHaveCSS("background-color", /rgba?\((\d+), \1, \1(?:, [\d.]+)?\)/);
}

test.beforeEach(async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
});

test("全画面で選択中のサイドバーアイコンが青くなり、文字・背景・装飾棒は変わらない", async ({ app }) => {
  const navigation = app.getByRole("navigation", { name: "メインナビゲーション" });
  for (const current of routes) {
    await navigate(app, current);
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    const leakedColor = await app.locator("main").evaluate(main => {
      const properties = ["color", "backgroundColor", "borderColor", "stroke"] as const;
      return [...main.querySelectorAll("h1, table th, table td, .kind-tabs button, .home-relation-name, .home-relation-subnode")]
        .filter(node => properties.some(property => getComputedStyle(node)[property].includes("rgb(0, 51, 255)")))
        .map(node => node.tagName);
    });
    expect(leakedColor, "表・見出し・種別タブ・相関図の名称と説明に青を広げない").toEqual([]);
    for (const name of routes) {
      const item = navigation.getByRole("button", { name, exact: true });
      await expect(item.locator("svg")).toHaveCSS("color", name === current ? blue : ink);
      await expect(item.locator("span")).toHaveCSS("color", ink);
      if (name === current) {
        await expect(item).toHaveCSS("background-color", soft);
        await expect(item).toHaveCSS("border-left-width", "0px");
        await expect(item).toHaveCSS("box-shadow", "none");
        for (const pseudo of ["::before", "::after"]) {
          expect(await item.evaluate((node, selector) => getComputedStyle(node, selector).content, pseudo)).toBe("none");
        }
      }
    }
  }
  await app.locator(".home-header").getByRole("button", { name: /サイドバー/ }).click();
  await settleMotion(app.locator("body"));
  await expect(navigation.getByRole("button", { name: "マスタ", exact: true }).locator("svg")).toHaveCSS("color", blue);
});

test("施策の文字・金額・科目・分類に青い編集枠が付き、解除すると戻る", async ({ page, app }, testInfo) => {
  await navigate(app, "施策入力");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator("body"));
  await app.locator(".home-header").getByRole("button", { name: "サイドバーを開く", exact: true }).click();
  await settleMotion(app.locator("body"));
  const name = app.getByRole("textbox", { name: "施策名", exact: true });
  const before = await name.boundingBox();
  await expectEditingColor(name);
  expect(await name.boundingBox()).toEqual(before);
  await attachImage(testInfo, "青い編集枠と選択アイコン", await page.locator("#app-preview").screenshot());
  await expectEditingColor(app.getByRole("textbox", { name: "備考", exact: true }));
  await expect(name).not.toHaveCSS("outline-color", blue);
  for (const label of ["展開名", "部署名", "期間名", "業種名"]) {
    const select = app.getByRole("spinbutton", { name: label, exact: true });
    await select.focus();
    await expect(select).toHaveCSS("outline-color", blue);
    await expect(select.locator(".is-selected")).toHaveCSS("color", ink);
  }
  const account = app.getByRole("combobox", { name: "1行目の勘定科目", exact: true });
  const value = await account.locator("option").nth(1).getAttribute("value");
  await account.selectOption(value!);
  await account.focus();
  await expect(account).toHaveCSS("outline-color", blue);
  const amount = app.locator(".initiative-amount-table input").first();
  await expectEditingColor(amount);
  await expect(app.locator('.kind-tabs [aria-selected="true"]')).toHaveCSS("border-bottom-color", ink);
  await expect(app.locator('.kind-tabs [aria-selected="true"]')).toHaveCSS("background-color", soft);
  await expect(app.getByRole("button", { name: "登録", exact: true })).toHaveCSS("background-color", ink);
  await app.getByRole("heading", { name: "施策入力", exact: true }).click();
  await expect(amount).not.toHaveCSS("outline-color", blue);
  await expect(app.locator(".classification-slot").first()).not.toHaveCSS("outline-color", blue);
});

test("前年金額は編集位置だけ青く、範囲選択の背景と罫線はグレーを保つ", async ({ page, app }) => {
  await navigate(app, "前年入力");
  const industry = app.getByLabel("業種名", { exact: true });
  const industryChoice = industry.getByRole("button", { name: "直営自動車", exact: true });
  await page.keyboard.press("Tab");
  await industryChoice.focus();
  await expect(industryChoice).toBeFocused();
  await selectClassification(industry, "直営自動車");
  await selectClassification(app.getByLabel("部署名", { exact: true }), "部署A");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator("body"));
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  await expectEditingColor(april);
  await april.press("Shift+ArrowRight");
  const may = app.getByRole("textbox", { name: "売上高 5月の前年金額", exact: true });
  await expect(may).toBeFocused();
  await expect(may).toHaveCSS("outline-color", blue);
  await expect(april).not.toHaveCSS("outline-color", blue);
  await expect(app.locator(".previous-cell-selected")).toHaveCount(2);
  for (const selected of await app.locator(".previous-cell-selected").all()) {
    await expect(selected).toHaveCSS("background-color", "rgb(250, 250, 250)");
    await expect(selected).toHaveCSS("box-shadow", "rgb(163, 163, 163) 0px 0px 0px 1px inset");
  }
});

test("全マスタの登録・編集欄と集計編集にも青を適用する", async ({ app }) => {
  for (const master of ["勘定科目マスタ", "展開マスタ", "業種マスタ", "部署マスタ", "期間マスタ"]) {
    await navigate(app, "マスタ");
    await app.locator(".master-menu").getByRole("button", { name: new RegExp(`^${master}`) }).click();
    await expect(app.getByRole("heading", { name: master, exact: true })).toBeVisible();
    for (const input of await app.locator(".account-master-form input").all()) await expectEditingColor(input);
    await app.locator(".account-master-list").getByRole("button", { name: /を編集$/ }).first().click();
    for (const input of await app.locator(".account-master-table input").all()) await expectEditingColor(input);
  }
  await navigate(app, "マスタ");
  await app.locator(".master-menu").getByRole("button", { name: /^集計マスタ/ }).click();
  await app.getByRole("button", { name: "売上集計を編集", exact: true }).click();
  for (const input of await app.locator(".graph-editor input:not(:disabled)").all()) await expectEditingColor(input);
  const target = app.locator(".graph-editor select").first();
  await target.focus();
  await expect(target).toHaveCSS("outline-color", blue);
  await expect(app.locator('.sidebar-item[aria-current="page"] svg')).toHaveCSS("color", blue);
  await navigate(app, "マスタ");
  await app.locator(".master-menu").getByRole("button", { name: /^種別マスタ/ }).click();
  await expect(app.getByRole("heading", { name: "種別マスタ", exact: true })).toBeVisible();
  await expect(app.locator("main input")).toHaveCount(0);
});

test("入口の年度以外のボタンと確認ダイアログのフォーカスはモノクロ", async ({ page, app }) => {
  const close = app.getByRole("button", { name: "ファイルを閉じる", exact: true });
  await page.keyboard.press("Tab");
  await close.focus();
  await expect(close).toHaveCSS("outline-color", ink);
  await close.click();
  const cancel = app.getByRole("button", { name: "キャンセル", exact: true });
  await page.keyboard.press("Tab");
  await cancel.focus();
  await expect(cancel).toHaveCSS("outline-color", ink);
  await cancel.click();
  await close.click();
  await app.getByRole("button", { name: "閉じる", exact: true }).click();
  const year = app.getByRole("spinbutton", { name: "年度", exact: true });
  await page.keyboard.press("Tab");
  await year.focus();
  await expect(year).toHaveCSS("outline-color", blue);
  const create = app.getByRole("button", { name: "新規作成", exact: true });
  await create.focus();
  await expect(create).toHaveCSS("outline-color", ink);
  await expect(year).not.toHaveCSS("outline-color", blue);
});

test("配布用ビルドでも選択アイコンと編集枠が同じ青になる", async ({ page, context }) => {
  const bytes = await page.evaluate(async path => (await import(path)).fixtureBytes as number[], "/tests/ui/preview.ts");
  const production = await context.newPage();
  const errors: string[] = [];
  production.on("pageerror", error => errors.push(error.message));
  try {
    await production.goto("/Triadichrome-extension/index.html");
    await production.evaluate(installMemoryFiles, { bytes, scenario: "normal" as const });
    await production.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    await openInitiativeEntry(production);
    await expectEditingColor(production.getByRole("textbox", { name: "施策名", exact: true }));
    await expect(production.locator('.sidebar-item[aria-current="page"] svg')).toHaveCSS("color", blue);
    await expect(production.locator('.sidebar-item[aria-current="page"] span')).toHaveCSS("color", ink);
    expect(errors).toEqual([]);
  } finally { await production.close(); }
});
