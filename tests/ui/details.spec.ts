import { test, expect, settleMotion, attachImage } from "./fixtures";

test("明細の操作説明を省き、見出しの直下から表を広げる", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "明細", exact: true }).click();
  await settleMotion(app.locator("body"));
  await expect(app.getByText(/セルをダブルクリックして編集|施策名を押すと/)).toHaveCount(0);
  const spacing = await app.locator(".detail-page").evaluate(element => {
    const heading = element.querySelector(".detail-toolbar")!.getBoundingClientRect();
    const table = element.querySelector(".detail-scroll")!.getBoundingClientRect();
    return table.top - heading.bottom;
  });
  expect(spacing).toBeLessThanOrEqual(8);
});

test("明細の直接編集・全件表示・施策への移動と帰還", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "明細", exact: true }).click();
  const table = app.locator(".detail-table");
  await expect(table.locator("tbody tr")).toHaveCount(1704);
  await settleMotion(app.locator("body"));
  const first = table.locator("tbody tr").first();
  const id = await first.getAttribute("data-detail-id");
  const amount = app.locator(`[data-cell="${id}-amount"]`);
  await amount.dblclick();
  await app.getByLabel("金額を編集", { exact: true }).fill("12.345");
  await app.getByLabel("金額を編集", { exact: true }).press("Tab");
  await expect(amount).toHaveText("12");
  await expect(table.locator("tbody tr").nth(1).locator('[data-cell$="-amount"]')).toBeFocused();
  await amount.dblclick();
  await expect(app.getByLabel("金額を編集", { exact: true })).toHaveValue("12.345");
  await app.getByLabel("金額を編集", { exact: true }).press("Escape");
  await expect(table.locator("thead button")).toHaveCount(0);
  await expect(app.getByRole("button", { name: "クリア", exact: true })).toHaveCount(0);
  const link = table.getByRole("button", { name: "確定予算の下期調整", exact: true }).first();
  await link.dblclick();
  await expect(app.getByLabel("施策名を編集", { exact: true })).toBeVisible();
  await app.getByLabel("施策名を編集", { exact: true }).press("Escape");
  await link.click();
  await app.getByRole("button", { name: "← 明細へ戻る", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1704);
  await expect(table.locator("tbody tr").first()).toHaveAttribute("data-detail-id", id!);
  const region = app.locator(".detail-scroll");
  expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await settleMotion(app.locator("body"));
  await attachImage(testInfo, "明細", await page.locator("#app-preview").screenshot());
});

test("不正値と保存失敗で入力を保持し、取消では元の値に戻る", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await page.getByLabel("ファイル操作").selectOption("save-failure");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "明細", exact: true }).click();
  const cell = app.locator(".detail-table tbody tr").first().locator('[data-cell$="-amount"]');
  const original = await cell.innerText();
  await cell.dblclick();
  const input = app.getByLabel("金額を編集", { exact: true });
  await input.fill("0.0001"); await input.press("Enter");
  await expect(app.getByRole("alert")).toContainText("3桁");
  await expect(input).toHaveValue("0.0001");
  await input.fill("15"); await input.press("Enter");
  await expect(app.getByRole("alert")).toContainText("保存失敗");
  await expect(input).toHaveValue("15");
  await expect(app.getByRole("button", { name: "施策一覧", exact: true })).toBeDisabled();
  await input.press("Escape"); await expect(cell).toHaveText(original);
});


test("明細の売上・費用・利益の列順と科目属性ごとの金額", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "明細", exact: true }).click();
  const table = app.locator(".detail-table");
  await expect(table.getByRole("columnheader", { name: "費用", exact: true })).toBeVisible();
  const headers = await table.getByRole("columnheader").allTextContents();
  expect(headers.slice(headers.indexOf("売上"), headers.indexOf("利益") + 1)).toEqual(["売上", "費用", "利益"]);
  expect(headers.some(name => name.includes("への影響"))).toBe(false);
  for (const [name, account, expected] of [
    ["前年", "給料手当", ["0", "200", "-200"]],
    ["既存商品の販売拡大", "売上高", ["120", "0", "120"]],
    ["既存商品の販売拡大", "本支店売上原価", ["-60", "0", "-60"]],
    ["既存商品の販売拡大", "宣伝広告費", ["0", "8", "-8"]],
    ["通信運搬費と消耗品費の削減", "通信運搬費", ["0", "-3", "3"]],
    ["既存商品の販売拡大", "営業外収益", ["0", "0", "0"]],
  ] as const) {
    const row = table.locator("tbody tr").filter({ has: app.getByRole("button", { name, exact: true }) }).filter({ has: app.getByRole("cell", { name: account, exact: true }) }).first();
    for (const [index, column] of ["sales", "expense", "profit"].entries()) {
      const cell = row.locator(`[data-cell$="-${column}"]`);
      await expect(cell).toHaveText(expected[index]!);
      await expect(cell).toHaveAttribute("tabindex", "-1");
    }
  }
});

test("明細の連続クリックと編集・取消・画面切替で古い遷移を実行しない", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "明細", exact: true }).click();
  const first = app.getByRole("button", { name: "既存商品の販売拡大", exact: true }).first();
  const second = app.getByRole("button", { name: "保守サービスの新規契約", exact: true }).first();
  await first.click();
  await page.waitForTimeout(200);
  await second.click();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("保守サービスの新規契約");
  await app.getByRole("button", { name: "← 明細へ戻る", exact: true }).click();
  const cell = app.locator(".detail-table tbody tr").first().locator('[data-cell$="-amount"]');
  for (const cancel of [false, true]) {
    await first.click(); await page.waitForTimeout(150); await second.click();
    await cell.dblclick();
    const input = app.getByLabel("金額を編集", { exact: true });
    await input.fill("123.456");
    if (cancel) await input.press("Escape");
    await page.waitForTimeout(800);
    await expect(app.getByRole("heading", { name: "明細", exact: true })).toBeVisible();
    if (!cancel) { await expect(input).toHaveValue("123.456"); await input.press("Escape"); }
  }
  await first.click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  await page.waitForTimeout(800);
  await expect(app.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
});
