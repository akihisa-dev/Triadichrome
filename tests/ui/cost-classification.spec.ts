import { test, expect, settleMotion } from "./fixtures";

test("総原価表は部署・業種の順のドロップダウンで個別と全件合計を切り替える", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation").getByRole("button", { name: "総原価表", exact: true }).click();
  await app.getByRole("heading", { name: "総原価表", exact: true }).click();
  await settleMotion(app.locator("body"));
  const industry = app.getByRole("combobox", { name: "業種名", exact: true });
  const department = app.getByRole("combobox", { name: "部署名", exact: true });
  const cells = app.locator(".cost-data-row").filter({ has: app.getByRole("rowheader", { name: "売上高", exact: true }) }).locator("td");
  await expect(app.locator(".cost-classification-row label")).toHaveText(["部署名", "業種名"]);
  await expect(cells.first()).toHaveText("25,290");
  await department.selectOption({ label: "部署A" });
  await expect(cells.first()).toHaveText("12,600");
  await industry.selectOption({ label: "直営自動車" });
  await expect(cells.first()).toHaveText("1,000");
  const amounts = (await cells.allTextContents()).slice(0, 3).map(value => Number(value.replaceAll(",", "")));
  expect(amounts[2]).toBe(amounts[1]! - amounts[0]!);
  await department.selectOption({ label: "部署B" });
  await expect(industry.locator("option:checked")).toHaveText("直営自動車");
  await expect(cells.first()).toHaveText("1,010");
  await department.selectOption("");
  await expect(cells.first()).toHaveText("2,010");
  await industry.selectOption("");
  await expect(cells.first()).toHaveText("25,290");
  await expect.poll(() => app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("金額未登録の分類も候補に表示し、部署の所属に絞る", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=large");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation").getByRole("button", { name: "総原価表", exact: true }).click();
  const department = app.getByRole("combobox", { name: "部署名", exact: true });
  const industry = app.getByRole("combobox", { name: "業種名", exact: true });
  await expect(industry.locator("option")).toHaveCount(10);
  await expect(department.locator("option")).toHaveCount(5);
  await department.selectOption({ label: "単一業種確認部署" });
  await expect(industry.locator("option:checked")).toHaveText("不動産A");
  await expect(industry.locator("option")).toHaveCount(2);
  await department.selectOption({ label: "複数業種確認部署" });
  await expect(industry).toHaveValue("");
  await expect(industry.locator("option")).toHaveText(["全業種の合計", "直営自動車", "自動車取扱"]);
  await industry.selectOption({ label: "自動車取扱" });
  await expect(app.locator(".cost-data-row").first().locator("td").first()).toHaveText("");
});
