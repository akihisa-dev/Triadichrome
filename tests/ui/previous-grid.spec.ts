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
      await selectClassification(app.getByRole("group", { name: "業種名", exact: true }), "直営自動車");
      await selectClassification(app.getByRole("group", { name: "部署名", exact: true }), "部署A");
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
  await selectClassification(app.getByRole("group", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("group", { name: "部署名", exact: true }), "部署A");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator(".home-layout"));
  const cell = (name: string, month: number) => app.getByRole("textbox", { name: `${name} ${month}月の前年金額`, exact: true });
  const april = cell("売上高", 4);
  await expect(app.locator(".previous-grid thead tr:first-child th")).toHaveText(["科目・集計", ...[4,5,6,7,8,9,10,11,12,1,2,3].map(m => `${m}月`)]);
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
  await selectClassification(app.getByRole("group", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("group", { name: "部署名", exact: true }), "部署A");
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
  const industry = app.getByRole("group", { name: "業種名", exact: true });
  const department = app.getByRole("group", { name: "部署名", exact: true });
  const sales = app.locator(".previous-grid .cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td").first();
  await expect(industry.getByRole("button", { name: "全業種の合計", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(department.getByRole("button", { name: "全部署の合計", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.locator(".previous-input-page select")).toHaveCount(0);
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


test("前年入力の横並び分類で末尾の候補を選び、合計と入力の切り替えを保持する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "前年入力", exact: true }).click();
  await app.getByRole("heading", { name: "前年入力", exact: true }).click();
  const industry = app.getByRole("group", { name: "業種名", exact: true });
  const department = app.getByRole("group", { name: "部署名", exact: true });
  await expect.poll(() => industry.evaluate(node => {
    const style = getComputedStyle(node);
    const tops = Array.from(node.querySelectorAll("button")).map(button => button.getBoundingClientRect().top);
    return { scrollbar: style.scrollbarWidth, webkitScrollbar: getComputedStyle(node, "::-webkit-scrollbar").display,
      oneRow: Math.max(...tops) - Math.min(...tops) < 1, scrollable: node.scrollWidth > node.clientWidth };
  })).toEqual({ scrollbar: "none", webkitScrollbar: "none", oneRow: true, scrollable: false });
  const last = industry.getByRole("button").last();
  await last.focus();
  await last.press("Space");
  await expect(last).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => last.evaluate(node => {
    const selected = node.getBoundingClientRect();
    const viewport = node.parentElement!.getBoundingClientRect();
    return selected.left >= viewport.left && selected.right <= viewport.right && selected.top >= viewport.top && selected.bottom <= viewport.bottom;
  })).toBe(true);
  await department.getByRole("button", { name: "部署A", exact: true }).click();
  await expect(app.locator(".previous-grid input").first()).toBeVisible();
  await industry.getByRole("button", { name: "全業種の合計", exact: true }).click();
  await expect(industry.getByRole("button", { name: "全業種の合計", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.locator(".previous-grid input")).toHaveCount(0);
  await expect.poll(() => app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});


test("前年のチップは複数選択・個別解除でき、合計表示から単一組み合わせの入力へ戻れる", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation").getByRole("button", { name: "前年入力", exact: true }).click();
  const industry = app.getByRole("group", { name: "業種名", exact: true });
  const department = app.getByRole("group", { name: "部署名", exact: true });
  const sales = app.locator(".previous-grid .cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td").first();
  const first = industry.getByRole("button", { name: "直営自動車", exact: true });
  const second = industry.getByRole("button", { name: "自動車取扱", exact: true });
  await first.click();
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(sales).toHaveText("4,220");
  await department.getByRole("button", { name: "部署A", exact: true }).click();
  await expect(sales).toHaveText("2,100");
  await department.getByRole("button", { name: "部署B", exact: true }).click();
  await expect(sales).toHaveText("4,220");
  await expect(app.locator(".previous-grid input")).toHaveCount(0);
  await second.click();
  await expect(sales).toHaveText("2,010");
  await department.getByRole("button", { name: "部署B", exact: true }).click();
  await expect(sales.locator("input")).toHaveValue("1000");
  await first.click();
  await expect(sales).toHaveText("12,600");
  await expect(industry.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
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
  const industry = app.getByRole("group", { name: "業種名", exact: true });
  const department = app.getByRole("group", { name: "部署名", exact: true });
  await selectClassification(industry, "直営自動車");
  await expect(app.getByRole("alert")).toContainText("範囲を超えています");
  await selectClassification(department, "部署A");
  const april = app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true });
  await expect(april).toHaveValue("5000000000000");
  await expect(app.getByRole("alert")).toHaveCount(0);
  await department.getByRole("button", { name: "部署B", exact: true }).click();
  await expect(app.getByRole("alert")).toContainText("範囲を超えています");
  await department.getByRole("button", { name: "部署B", exact: true }).click();
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
