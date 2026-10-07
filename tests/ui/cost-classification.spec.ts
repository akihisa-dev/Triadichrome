import { test, expect, settleMotion } from "./fixtures";

test("総原価表の分類チップで複数選択・個別解除・全件合計を切り替える", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "総原価表", exact: true }).click();
  await app.getByRole("heading", { name: "総原価表", exact: true }).click();
  await settleMotion(app.locator("body"));
  const industry = app.getByRole("group", { name: "業種名", exact: true });
  const department = app.getByRole("group", { name: "部署名", exact: true });
  const cells = app.locator(".cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td");
  await expect(app.getByText("集計に未所属の科目が2件あります。", { exact: true })).toHaveCount(0);
  await expect(app.getByRole("button", { name: "集計マスタを開く", exact: true })).toHaveCount(0);
  await expect(cells.first()).toHaveText("25,290");
  const first = industry.getByRole("button", { name: "直営自動車", exact: true });
  const second = industry.getByRole("button", { name: "自動車取扱", exact: true });
  await first.click();
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(cells.first()).toHaveText("4,220");
  await department.getByRole("button", { name: "部署A", exact: true }).click();
  await expect(cells.first()).toHaveText("2,100");
  const amounts = (await cells.allTextContents()).slice(0, 3).map(value => Number(value.replaceAll(",", "")));
  expect(amounts[2]).toBe(amounts[1]! - amounts[0]!);
  await department.getByRole("button", { name: "部署B", exact: true }).click();
  await expect(cells.first()).toHaveText("4,220");
  await second.click();
  await expect(cells.first()).toHaveText("2,010");
  await first.click();
  await expect(cells.first()).toHaveText("25,290");
  await department.getByRole("button", { name: "全部署の合計", exact: true }).click();
  await expect(department.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  for (const group of [industry, department]) {
    expect(await group.evaluate(node => {
      const boxes = Array.from(node.querySelectorAll("button")).map(button => button.getBoundingClientRect());
      const bounds = node.getBoundingClientRect();
      return node.scrollWidth <= node.clientWidth && Math.max(...boxes.map(box => box.top)) - Math.min(...boxes.map(box => box.top)) < 1
        && boxes.every(box => box.left >= bounds.left && box.right <= bounds.right + 1);
    })).toBe(true);
  }
});

test("総原価表は金額未登録でもマスタの全分類をチップに表示する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=defaults");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "総原価表", exact: true }).click();
  await expect(app.getByRole("group", { name: "業種名", exact: true }).getByRole("button")).toHaveCount(10);
  await expect(app.getByRole("group", { name: "部署名", exact: true }).getByRole("button")).toHaveCount(3);
});
