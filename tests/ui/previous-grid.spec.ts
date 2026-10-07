import { test, expect, settleMotion, selectClassification } from "./fixtures";

test("前年の列見出しは縦横スクロール後も本文に覆われない", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).first().click();
  await settleMotion(app.locator(".home-layout"));
  const region = app.getByRole("region", { name: "前年の月別金額", exact: true });
  for (const editable of [false, true]) {
    if (editable) {
      await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
      await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
    }
    for (const bottom of [false, true]) {
      await region.evaluate((node, atBottom) => {
        node.scrollTop = atBottom ? node.scrollHeight : 320;
        node.scrollLeft = atBottom ? node.scrollWidth : 180;
      }, bottom);
      await expect.poll(() => region.evaluate(node => {
        const edge = node.getBoundingClientRect();
        const headers = Array.from(node.querySelectorAll("thead th"));
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
    }
  }
});

test("前年セルの範囲入力・集計・無効な貼り付け・保存後の再表示", async ({ page, app }, testInfo) => {
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "前年入力", exact: true }).first().click();
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
  await page.mouse.move(page.viewportSize()!.width - 10, 200);
  await settleMotion(app.locator(".home-layout"));
  const cell = (name: string, month: number) => app.getByRole("textbox", { name: `${name} ${month}月の前年金額`, exact: true });
  const april = cell("売上高", 4);
  await expect(app.locator(".previous-grid thead th")).toHaveText(["科目・集計", ...[4,5,6,7,8,9,10,11,12,1,2,3].map(m => `${m}月`)]);
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
  await expect(app.locator(".previous-grid tbody tr").nth(2).locator("td").first()).toHaveText("1,225");
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
  await selectClassification(app.getByRole("spinbutton", { name: "業種名", exact: true }), "直営自動車");
  await selectClassification(app.getByRole("spinbutton", { name: "部署名", exact: true }), "部署A");
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
  const industry = app.getByRole("spinbutton", { name: "業種名", exact: true });
  const department = app.getByRole("spinbutton", { name: "部署名", exact: true });
  const sales = app.locator(".previous-grid tbody tr").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td").first();
  await expect(industry).toHaveAttribute("aria-valuetext", "全業種の合計");
  await expect(department).toHaveAttribute("aria-valuetext", "全部署の合計");
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
