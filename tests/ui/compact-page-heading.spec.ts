import { test, expect, settleMotion, selectClassification } from "./fixtures";

for (const screen of ["施策一覧", "前年入力"] as const) {
  test(`${screen}の見出しと操作を一行にまとめ、狭い画面でも操作できる`, async ({ page, app }, testInfo) => {
    await page.goto("/tests/ui/preview.html");
    await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    await app.getByRole("complementary", { name: "メニュー", exact: true }).getByRole("button", { name: screen, exact: true }).click();
    await page.mouse.move(page.viewportSize()!.width - 10, 0);
    await app.getByRole("heading", { name: screen, exact: true }).click();
    await settleMotion(app.locator("body"));
    const metrics = await app.locator("main .initiative-list-heading").evaluate(node => {
      const rects = Array.from(node.querySelectorAll("h1, .field-hint, [role=spinbutton], [role=group], .primary-button")).map(item => item.getBoundingClientRect());
      return { centers: rects.map(rect => rect.y + rect.height / 2),
        inside: rects.every(rect => rect.left >= 0 && rect.right <= window.innerWidth),
        overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(metrics.inside).toBe(true);
    expect(metrics.overflow).toBe(false);
    if (testInfo.project.name === "desktop") expect(Math.max(...metrics.centers) - Math.min(...metrics.centers)).toBeLessThan(2);
    if (screen === "施策一覧") {
      await selectClassification(app.getByRole("spinbutton", { name: "種別", exact: true }), "一次予算");
      await app.getByRole("button", { name: "施策を追加", exact: true }).click();
      await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
    } else {
      await selectClassification(app.getByRole("group", { name: "業種名", exact: true }), "直営自動車");
      await selectClassification(app.getByRole("group", { name: "部署名", exact: true }), "部署A");
      await expect(app.getByRole("textbox", { name: "売上高 4月の前年金額", exact: true })).toBeVisible();
      await expect(app.getByRole("button", { name: "保存を再試行", exact: true })).toHaveCount(0);
    }
  });
}
