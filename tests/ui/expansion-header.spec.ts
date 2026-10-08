import { test, expect, settleMotion } from "./fixtures";

for (const data of ["full", "large"] as const) {
  for (const comparison of [false, true]) {
    test(`展開計までの見出しを縦横スクロール中も保持する（${data}・${comparison ? "2種" : "1種"}）`, async ({ page, app }) => {
      await page.goto(`/tests/ui/preview.html?data=${data}`);
      await expect(page.getByRole("status")).toHaveText("操作できます");
      await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
      await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "展開表", exact: true }).click();
      if (comparison) await app.getByRole("spinbutton", { name: "比較対象2", exact: true }).getByRole("button", { name: "確定予算", exact: true }).click();
      const region = app.getByRole("region", { name: "展開表の月別種別・比較", exact: true });
      const header = region.locator("thead");
      await expect(header.locator("tr")).toHaveCount(6);
      await expect(header.locator(".expansion-summary")).toHaveText(["前年", "合計", "展開計"]);
      await app.getByRole("heading", { name: "展開表", exact: true }).click();
      await settleMotion(app.locator("body"));
      const top = (await region.boundingBox())!.y;
      const bodyTop = (await region.locator("tbody").first().boundingBox())!.y;
      const before = await header.locator("tr").evaluateAll(rows => rows.map(row => ({
        top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height,
        amounts: Array.from(row.querySelectorAll("td")).map(cell => cell.textContent),
      })));
      for (const left of [600, await region.evaluate(node => node.scrollWidth)]) {
        await region.evaluate((node, scrollLeft) => { node.scrollTop = node.scrollHeight; node.scrollLeft = scrollLeft; }, left);
        await expect.poll(() => region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
        await expect.poll(async () => Math.abs((await header.boundingBox())!.y - top)).toBeLessThan(2);
        const after = await header.locator("tr").evaluateAll(rows => rows.map(row => ({
          top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height,
          amounts: Array.from(row.querySelectorAll("td")).map(cell => cell.textContent),
        })));
        for (let index = 0; index < before.length; index++) {
          expect(Math.abs(after[index]!.top - before[index]!.top)).toBeLessThan(2);
          expect(after[index]!.height).toBeCloseTo(before[index]!.height, 0);
          expect(after[index]!.amounts).toEqual(before[index]!.amounts);
        }
        for (const summary of await header.locator(".expansion-summary").all()) await expect(summary).toBeInViewport();
        const group = header.getByRole("columnheader", { name: "展開名", exact: true });
        const name = header.getByRole("columnheader", { name: "施策名", exact: true });
        await expect(group).toBeInViewport();
        await expect(name).toBeInViewport();
        expect((await region.locator("tbody").first().boundingBox())!.y).toBeLessThan(bodyTop);
      }
    });
  }
}


test("展開表の比較対象を単位のすぐ右に置き、狭い画面では折り返す", async ({ page, app }, testInfo) => {
  await page.goto("/tests/ui/preview.html");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "展開表", exact: true }).click();
  await app.getByRole("heading", { name: "展開表", exact: true }).click();
  await settleMotion(app.locator("body"));
  const heading = app.locator(".expansion-table-page .initiative-list-heading");
  const inspect = async () => heading.evaluate(node => {
    const unit = node.querySelector(".field-hint")!.getBoundingClientRect();
    const selection = node.querySelector(".kind-selection-slots")!.getBoundingClientRect();
    return { gap: selection.left - unit.right, center: Math.abs(selection.top + selection.height / 2 - unit.top - unit.height / 2),
      wrapped: selection.top >= unit.bottom, overflow: document.documentElement.scrollWidth > window.innerWidth,
      order: Array.from(node.children).map(child => child.className || child.tagName) };
  });
  let bounds = await inspect();
  expect(bounds.order).toEqual(["H1", "field-hint", "kind-selection-slots"]);
  expect(bounds.overflow).toBe(false);
  if (testInfo.project.name === "desktop") {
    expect(bounds.gap).toBe(16);
    expect(bounds.center).toBeLessThan(1);
  } else expect(bounds.wrapped).toBe(true);
  const second = app.getByRole("spinbutton", { name: "比較対象2", exact: true });
  await second.getByRole("button", { name: "確定予算", exact: true }).click();
  await expect(second).toHaveAttribute("aria-valuetext", "確定予算");
  await expect(heading.getByText("比較：確定予算 − 一次予算", { exact: true })).toBeVisible();
  await settleMotion(heading);
  bounds = await inspect();
  expect(bounds.order).toEqual(["H1", "field-hint", "kind-selection-slots", "field-hint"]);
  expect(bounds.overflow).toBe(false);
  if (testInfo.project.name === "desktop") expect(bounds.gap).toBe(16);
});
