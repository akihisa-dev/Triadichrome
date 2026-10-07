import { openInitiativeEntry, test, expect, settleMotion } from "./fixtures";

for (const editing of [false, true]) {
  test(`${editing ? "登録済み施策" : "新規施策"}の施策名と備考を同じ幅に揃え、分類欄を折り返す`, async ({ page, app }, testInfo) => {
    await page.goto("/tests/ui/preview.html");
    await expect(page.getByRole("status")).toHaveText("操作できます");
    await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    if (editing) {
      await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "施策一覧", exact: true }).click();
      await app.getByRole("button", { name: "既存商品の販売拡大", exact: true }).click();
    } else await openInitiativeEntry(app);
    await app.getByRole("heading", { name: "施策入力", exact: true }).click();
    const name = app.getByRole("textbox", { name: "施策名", exact: true });
    const note = app.getByRole("textbox", { name: "備考", exact: true });
    const originalNote = await note.inputValue();
    for (const width of [1920, 1280, 900, 600, 375]) {
      await page.setViewportSize({ width, height: 864 });
      await settleMotion(app.locator("body"));
      const nameBox = (await name.boundingBox())!;
      const noteBox = (await note.boundingBox())!;
      expect(Math.abs(nameBox.width - noteBox.width)).toBeLessThan(1);
      expect(Math.abs(nameBox.x - noteBox.x)).toBeLessThan(1);
      expect(noteBox.y).toBeGreaterThan(nameBox.y + nameBox.height);
      const text = (await app.locator(".initiative-text-fields").boundingBox())!;
      const slots = (await app.locator(".initiative-classification-slots").boundingBox())!;
      if (width >= 1280) expect(slots.x).toBeGreaterThanOrEqual(text.x + text.width);
      else expect(slots.y).toBeGreaterThanOrEqual(text.y + text.height);
      expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await expect(note).toHaveValue(originalNote);
      if (width === 1920 || width === 600) await testInfo.attach(`施策入力-${editing ? "編集" : "新規"}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  });
}
