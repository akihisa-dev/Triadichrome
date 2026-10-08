import { test, expect, settleMotion, selectClassification } from "./fixtures";

test("展開表の結合セル・固定列・全月の列境界をスクロール後も保つ", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "展開表", exact: true }).click();
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "確定予算");
  await settleMotion(app.locator("body"));
  const region = app.getByRole("region", { name: "展開表の月別種別・比較", exact: true });
  const inspect = () => region.evaluate(node => {
    const table = node.querySelector("table")!;
    const rect = (element: Element) => element.getBoundingClientRect();
    const headers = table.querySelectorAll("thead tr:first-child th");
    const group = rect(headers[0]!); const period = rect(headers[1]!); const name = rect(headers[2]!);
    const summary = rect(table.querySelector(".expansion-summary")!);
    const amounts = [...table.querySelectorAll("tbody tr:first-child td")].slice(0, 114);
    const monthHeaders = [...headers].slice(3);
    const mismatch = monthHeaders.some((header, index) => {
      const start = rect(amounts[index * 6]!); const end = rect(amounts[index * 6 + 5]!);
      return Math.abs(rect(header).left - start.left) > 1 || Math.abs(rect(header).right - end.right) > 1;
    });
    const nameCells = [...table.querySelectorAll("tbody .expansion-name")];
    return { gap: name.left - period.right, summaryWidth: summary.width, labelsWidth: group.width + period.width + name.width,
      fixedNameMismatch: nameCells.some(cell => Math.abs(rect(cell).left - name.left) > 1), mismatch,
      bottom: rect(node).bottom, viewport: window.innerHeight,
      horizontal: node.scrollWidth > node.clientWidth, counts: [...table.querySelectorAll("tbody tr")].map(row => row.querySelectorAll("td").length),
      outside: document.documentElement.scrollWidth > window.innerWidth,
      lastRight: rect(table.querySelector("tbody tr td:last-child")!).right, regionRight: rect(node).right };
  });
  const check = async () => {
    const layout = await inspect();
    expect(Math.abs(layout.gap)).toBeLessThan(1);
    expect(Math.abs(layout.summaryWidth - layout.labelsWidth)).toBeLessThan(1);
    expect(layout.fixedNameMismatch).toBe(false);
    expect(layout.mismatch).toBe(false);
    expect(layout.counts.every(count => count === 114)).toBe(true);
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewport);
    expect(layout.outside).toBe(false);
    expect(layout.horizontal).toBe(true);
  };
  await check();
  // Stress cell contents without changing the saved plan or production sample.
  await region.evaluate(node => {
    node.querySelector(".initiative-name-button")!.textContent = "長い施策名".repeat(60);
    node.querySelector("tbody td")!.textContent = "-9,007,199,254,741";
  });
  await check();
  const overflow = await region.evaluate(node => {
    const amount = node.querySelector("tbody td")!;
    const name = node.querySelector(".initiative-name-button")!;
    return { amountClipped: getComputedStyle(amount).overflow === "hidden",
      nameFits: name.getBoundingClientRect().width <= name.parentElement!.getBoundingClientRect().width };
  });
  expect(overflow.amountClipped).toBe(true);
  expect(overflow.nameFits).toBe(true);
  await region.evaluate(node => { node.scrollLeft = 350; });
  await check();
  await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await check();
  const end = await inspect();
  expect(end.lastRight).toBeLessThanOrEqual(end.regionRight + 1);
  await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await check();
  const bottom = await region.evaluate(node => ({
    moved: node.scrollTop > 0,
    lastRowBottom: node.querySelector("tbody:last-child tr:last-child")!.getBoundingClientRect().bottom,
    regionBottom: node.getBoundingClientRect().bottom,
  }));
  expect(bottom.moved).toBe(true);
  expect(bottom.lastRowBottom).toBeLessThanOrEqual(bottom.regionBottom + 1);
  await region.evaluate(node => { node.scrollLeft = 0; node.scrollTop = 0; });
  const initiative = region.locator(".initiative-name-button").first();
  await initiative.click();
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("通信運搬費と消耗品費の削減");
});

test("施策がない展開も名称とゼロの小計を同じ列で表示する", async ({ page, app }) => {
  await page.goto("/tests/ui/preview.html?data=defaults");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "展開表", exact: true }).click();
  await selectClassification(app.getByRole("spinbutton", { name: "比較対象2", exact: true }), "確定予算");
  await settleMotion(app.locator("body"));
  const rows = app.locator(".expansion-table .expansion-subtotal");
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await expect(row.locator("th")).toHaveCount(2);
    await expect(row.locator("td")).toHaveCount(114);
    expect((await row.locator("td").allTextContents()).every(value => value === "")).toBe(true);
  }
});
