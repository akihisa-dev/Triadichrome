import { test, expect, settleMotion, selectClassification } from "./fixtures";

test("前年は列見出しから社内控除後売上まで縦横スクロール中も固定する", async ({ page, app }, testInfo) => {
  // Keep room for the frozen editable sales rows and the controls at narrow widths.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: testInfo.project.name === "narrow" ? 1400 : 1000 });
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).first().click();
  await settleMotion(app.locator(".home-layout"));
  const region = app.getByRole("region", { name: "前年の月別金額", exact: true });
  for (const editable of [false, true]) {
    if (editable) {
      await selectClassification(app.getByRole("combobox", { name: "業種名", exact: true }), "直営自動車");
      await selectClassification(app.getByRole("combobox", { name: "部署名", exact: true }), "部署A");
    }
    await region.evaluate(node => { node.scrollTop = 0; });
    const sales = region.getByRole("rowheader", { name: "社内控除後売上", exact: true });
    const initialSales = (await sales.boundingBox())!;
    const expense = region.getByRole("rowheader", { name: "旅費", exact: true });
    const initialExpense = (await expense.boundingBox())!;
    for (const bottom of [false, true]) {
      await region.evaluate((node, atBottom) => {
        node.scrollTop = atBottom ? node.scrollHeight : 320;
        node.scrollLeft = atBottom ? node.scrollWidth : 180;
      }, bottom);
      await expect.poll(() => region.evaluate(node => {
        const edge = node.getBoundingClientRect();
        const headers = Array.from(node.querySelectorAll("thead tr:first-child th"));
        const nameHeader = headers[0]!;
        return {
          scrolled: node.scrollTop > 0 && node.scrollLeft > 0,
          nameFixed: Math.abs(nameHeader.getBoundingClientRect().left - edge.left) < 2,
          visible: headers.filter(header => {
            const box = header.getBoundingClientRect();
            return (header === nameHeader || box.left >= nameHeader.getBoundingClientRect().right) && box.right <= edge.right;
          }).every(header => {
            const box = header.getBoundingClientRect();
            return Math.abs(box.top - edge.top) < 2 && [2, box.height / 2, box.height - 2].every(offset =>
              header.contains(node.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + offset)));
          }),
        };
      })).toEqual({ scrolled: true, nameFixed: true, visible: true });
      expect(Math.abs((await sales.boundingBox())!.y - initialSales.y)).toBeLessThan(2);
      expect((await expense.boundingBox())!.y).toBeLessThan(initialExpense.y);
      const lastAmount = region.locator(".cost-sales-anchor td").last();
      expect(Math.abs((await lastAmount.boundingBox())!.y - initialSales.y)).toBeLessThan(2);
    }
  }
});

test("前年セルの範囲入力・集計・無効な貼り付け・保存後の再表示", async ({ page, app }, testInfo) => {
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).first().click();
  await selectClassification(app.getByRole("combobox", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("combobox", { name: "部署名", exact: true }), "部署A");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator(".home-layout"));
  const cell = (name: string, month: number) => app.getByRole("textbox", { name: `${name} ${month}月の前年金額`, exact: true });
  const april = cell("売上高", 4);
  await expect(app.locator(".previous-grid thead tr:first-child th")).toHaveText(["科目・集計", ...[4,5,6,7,8,9,10,11,12,1,2,3].map(m => `${m}月`), "上期", "下期", "通期"]);
  // A browser paste event exercises the same handler as Excel's tab/newline clipboard text.
  const paste = async (text: string) => april.evaluate((node, value) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", value);
    node.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
  }, text);
  await april.click();
  await paste("1,200.125\t-0.001\n25\t0");
  await expect(april).toHaveValue("1200.125");
  await expect(cell("グループ売上高", 4)).toHaveValue("25");
  await expect(cell("売上高", 5)).toHaveValue("-0.001");
  await expect(app.locator(".previous-grid .cost-data-row").nth(2).locator("td").first()).toHaveText("1,225");
  await paste("7\t8\n9\t不正");
  await expect(app.getByRole("alert")).toContainText("金額");
  await expect(april).toHaveValue("1200.125");
  await april.click();
  await april.press("Shift+ArrowRight");
  await cell("売上高", 5).press("Shift+ArrowDown");
  await expect(app.locator(".previous-input-cell.previous-cell-selected")).toHaveCount(4);
  await cell("グループ売上高", 5).fill("3.125");
  await cell("グループ売上高", 5).press("ControlOrMeta+Enter");
  for (const account of ["売上高", "グループ売上高"]) for (const month of [4,5]) await expect(cell(account, month)).toHaveValue("3.125");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: testInfo.outputPath("previous-grid.png") });
  await cell("グループ売上高", 5).press("Delete");
  for (const account of ["売上高", "グループ売上高"]) for (const month of [4,5]) await expect(cell(account, month)).toHaveValue("0");
  await expect(app.getByRole("button", { name: "総原価表", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "総原価表", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).click();
  await selectClassification(app.getByRole("combobox", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("combobox", { name: "部署名", exact: true }), "部署A");
  await expect(april).toHaveValue("0");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator(".home-layout"));
  await cell("本支店売上高", 4).click();
  await cell("本支店売上高", 4).press("Shift+Tab");
  await expect(cell("グループ売上高", 3)).toBeFocused();
});


test("前年の初期合計・片側の分類・全件への切り替え", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).first().click();
  const industry = app.getByRole("combobox", { name: "業種名", exact: true });
  const department = app.getByRole("combobox", { name: "部署名", exact: true });
  const sales = app.locator(".previous-grid .cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td").first();
  await expect(industry).toHaveValue("");
  await expect(department).toHaveValue("");
  await expect(app.locator(".previous-input-page select")).toHaveCount(2);
  await expect(sales).toHaveText("25,290");
  await expect(app.locator(".previous-grid input")).toHaveCount(0);
  await selectClassification(industry, "直営自動車");
  await expect(sales).toHaveText("2,010");
  await selectClassification(department, "部署A");
  await expect(sales.locator("input")).toHaveValue("1000");
  await selectClassification(industry, "全業種の合計");
  await expect(sales).toHaveText("12,600");
  await expect(app.locator(".previous-grid input")).toHaveCount(0);
  await selectClassification(department, "全部署の合計");
  await expect(sales).toHaveText("25,290");
});


test("部署・業種の順序、所属候補と期間合計の表示・入力追従", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=large");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation").getByRole("button", { name: "前年入力", exact: true }).click();
  const department = app.getByRole("combobox", { name: "部署名", exact: true });
  const industry = app.getByRole("combobox", { name: "業種名", exact: true });
  await expect(app.locator(".previous-input-page .classification-field label")).toHaveText(["部署名", "業種名"]);
  await department.selectOption({ label: "単一業種確認部署" });
  await expect(industry.locator("option:checked")).toHaveText("不動産A");
  await department.selectOption({ label: "複数業種確認部署" });
  await expect(industry).toHaveValue("");
  await expect(industry.locator("option")).toHaveText(["全業種の合計", "直営自動車", "自動車取扱"]);
  await department.selectOption({ label: "部署A" });
  await industry.selectOption({ label: "直営自動車" });
  const sales = app.locator(".previous-grid .cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) });
  await expect(sales.locator("td.period-half")).toHaveText(["6,000", "6,000"]);
  await expect(sales.locator("td.period-annual")).toHaveText("12,000");
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  await april.fill("1001.499");
  await expect(sales.locator("td.period-half")).toHaveText(["6,001", "6,000"]);
  await expect(sales.locator("td.period-annual")).toHaveText("12,001");
  await expect(app.locator(".previous-grid .period-half input, .previous-grid .period-annual input")).toHaveCount(0);
  await expect.poll(() => app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});


test("前年の分類合計が上限を超えても分類変更と金額修正を続けられる", async ({ page, app }) => {
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  await page.goto("/tests/ui/preview.html?data=overflow-previous-input");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const nav = app.getByRole("navigation", { name: "メインナビゲーション" });
  await nav.getByRole("button", { name: "前年入力", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("範囲を超えています");
  const sales = app.locator(".previous-grid .cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td").first();
  await expect(sales).toHaveText("");
  const industry = app.getByRole("combobox", { name: "業種名", exact: true });
  const department = app.getByRole("combobox", { name: "部署名", exact: true });
  await selectClassification(industry, "直営自動車");
  await expect(app.getByRole("alert")).toContainText("範囲を超えています");
  await selectClassification(department, "部署A");
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  await expect(april).toHaveValue("5000000000000");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await department.selectOption("");
  await expect(app.getByRole("alert")).toContainText("範囲を超えています");
  await department.selectOption({ label: "部署A" });
  await april.fill("1"); await april.press("Tab");
  await expect(nav.getByRole("button", { name: "総原価表", exact: true })).toBeEnabled();
  await nav.getByRole("button", { name: "総原価表", exact: true }).click();
  await nav.getByRole("button", { name: "前年入力", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveCount(0);
  await selectClassification(industry, "直営自動車");
  await selectClassification(department, "部署A");
  await expect(april).toHaveValue("1");
  expect(failures).toEqual([]);
});


test("多科目の入力行を再検索せずに金額と選択を保持する", async ({ page }) => {
  await page.goto("/tests/ui/performance-preview.html?mode=previous&count=100&guard=1");
  const cell = page.getByRole("textbox", { name: "科目99 4月の前年金額", exact: true });
  await expect(cell).toHaveValue("0");
  await cell.fill("-0.001"); await expect(cell).toHaveValue("-0.001");
  await cell.press("Tab");
  await expect(page.getByRole("textbox", { name: "科目99 5月の前年金額", exact: true })).toBeFocused();
  await expect(cell).toHaveValue("-0.001");
});

for (const key of ["Enter", "Tab"]) test(`前年の直接入力エラーを${key}で訂正し、Escと他セルの未解決入力を区別する`, async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "前年入力", exact: true }).click();
  await selectClassification(app.getByRole("combobox", { name: "部署名", exact: true }), "部署A");
  await selectClassification(app.getByRole("combobox", { name: "業種名", exact: true }), "直営自動車");
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  const may = app.getByRole("textbox", { name: "売上高 5月の前年金額", exact: true });
  await april.fill("0.0001"); await april.press(key);
  await expect(app.getByRole("alert").filter({ hasText: "小数点" })).toHaveCount(1);
  await april.fill("2"); await april.press(key);
  await expect(app.getByRole("alert")).toHaveCount(0);
  await expect(app.getByRole("button", { name: "操作を取り消す", exact: true })).toBeEnabled();
  await april.fill("0.0001"); await april.press("Enter");
  await expect(app.getByRole("alert").filter({ hasText: "小数点" })).toHaveCount(1);
  await april.press("Escape");
  await expect(april).toHaveValue("2");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await april.fill("0.0001"); await april.press("Enter");
  await may.fill("0.0002"); await may.press("Enter");
  await may.fill("3"); await may.press(key);
  await expect(april).toHaveAttribute("aria-invalid", "true");
  await expect(app.getByRole("alert").filter({ hasText: "小数点" })).toHaveCount(1);
  await april.fill("4"); await april.press(key);
  await expect(app.getByRole("alert")).toHaveCount(0);
  await expect(app.getByRole("button", { name: "操作を取り消す", exact: true })).toBeEnabled();
});

test("前年の訂正後も実際の保存失敗と合計超過を通知し、入力取消で復旧する", async ({ page, app }) => {
  await page.getByLabel("テストデータ", { exact: true }).selectOption("defaults");
  await page.getByLabel("ファイル操作", { exact: true }).selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "前年入力", exact: true }).click();
  await selectClassification(app.getByRole("combobox", { name: "部署名", exact: true }), "部署A");
  await selectClassification(app.getByRole("combobox", { name: "業種名", exact: true }), "直営自動車");
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  await april.fill("0.0001"); await april.press("Enter");
  await april.fill("2"); await april.press("Enter");
  await expect(app.getByRole("alert")).toContainText("テスト用の保存失敗");
  await expect(app.getByRole("alert").filter({ hasText: "小数点" })).toHaveCount(0);
  await expect(april).toHaveValue("2");
  await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
  await expect(april).toHaveValue("0"); await expect(app.getByRole("alert")).toHaveCount(0);
  await april.fill("9007199254740.991"); await april.press("Enter");
  const other = app.getByRole("textbox", { name: "グループ売上高 4月の前年金額", exact: true });
  await other.fill("0.001"); await other.press("Enter");
  await expect(app.getByRole("alert").filter({ hasText: "合計が正確" })).toHaveCount(1);
  await expect(april).toHaveValue("9007199254740.991");
  await expect(other).toHaveValue("0.001");
  await expect(app.getByRole("button", { name: "入力を取り消す", exact: true })).toBeEnabled();
  await app.getByRole("button", { name: "入力を取り消す", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveCount(0);
});
