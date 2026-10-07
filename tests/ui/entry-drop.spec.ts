import { test, expect, settleMotion } from "./fixtures";

test("ファイルの受け入れ先を強調し、子要素への移動で保持し、退出とドロップで解除する", async ({ page, app }, testInfo) => {
  const entry = app.locator(".entry-page");
  const open = app.locator(".entry-open-section");
  await expect(open).toContainText(".triadicファイルをここにドロップ");
  const transfer = await page.frames()[1]!.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["invalid"], "確認.triadic"));
    return data;
  });
  // Dispatch real file drag events against the production entry, without changing state directly.
  const frame = page.frames()[1]!;
  await frame.locator(".entry-open-section").dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(app.getByRole("heading", { name: "ここにドロップして開く", exact: true })).toBeVisible();
  await settleMotion(open);
  await expect(open).toHaveCSS("background-color", "rgb(238, 242, 255)");
  expect(await open.evaluate(node => {
    const frame = getComputedStyle(node, "::after");
    return [frame.opacity, frame.borderTopStyle, frame.borderTopColor];
  })).toEqual(["1", "dashed", "rgb(0, 51, 255)"]);
  expect(await entry.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await testInfo.attach("ファイルのドロップ先", { body: await page.screenshot(), contentType: "image/png" });

  await frame.locator(".entry-open-section").evaluate(node => {
    node.dispatchEvent(new DragEvent("dragleave", { bubbles: true, relatedTarget: node.querySelector("button") }));
  });
  await expect(app.getByRole("heading", { name: "ここにドロップして開く", exact: true })).toBeVisible();
  await frame.locator(".entry-page").dispatchEvent("dragleave", { relatedTarget: null });
  await expect(app.getByRole("heading", { name: "ファイルを開く", exact: true })).toBeVisible();
  await settleMotion(open);
  expect(await open.evaluate(node => getComputedStyle(node, "::after").opacity)).toBe("0");

  const text = await frame.evaluateHandle(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "text");
    return data;
  });
  await frame.locator(".entry-open-section").dispatchEvent("dragover", { dataTransfer: text });
  await expect(entry).not.toHaveClass(/is-drag-active/);
  await frame.locator(".entry-open-section").dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(entry).toHaveClass(/is-drag-active/);
  await frame.locator(".entry-open-section").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(entry).not.toHaveClass(/is-drag-active/);
  await expect(app.getByRole("alert")).toBeVisible();
  await expect(app.getByRole("heading", { name: "ファイルを開く", exact: true })).toBeVisible();
});
