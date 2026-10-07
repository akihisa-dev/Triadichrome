import { test, expect, settleMotion } from "./fixtures";

test("展開表の3段見出しと名称列を縦横スクロール中も保持する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "展開表", exact: true }).click();
  const region = app.getByRole("region", { name: "展開表の月別種別・比較", exact: true });
  const header = region.locator("thead");
  await expect(header).toBeVisible();
  await settleMotion(app.locator("body"));
  const top = (await region.boundingBox())!.y;
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; node.scrollLeft = 600; });
  await expect.poll(() => region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => Math.abs((await header.boundingBox())!.y - top)).toBeLessThan(2);
  const rows = await header.locator("tr").all();
  for (const row of rows) await expect(row).toBeInViewport();
  const group = header.getByRole("columnheader", { name: "展開名", exact: true });
  const name = header.getByRole("columnheader", { name: "施策名", exact: true });
  await expect(group).toBeInViewport();
  await expect(name).toBeInViewport();
  const bounds = await region.boundingBox();
  expect((await group.boundingBox())!.x).toBeCloseTo(bounds!.x, 0);
  expect((await name.boundingBox())!.x).toBeCloseTo(bounds!.x + (await group.boundingBox())!.width, 0);
  const firstCell = region.locator("tbody td").first();
  expect((await firstCell.boundingBox())!.y).toBeLessThan((await header.boundingBox())!.y);
});


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
