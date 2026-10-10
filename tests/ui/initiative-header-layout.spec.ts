import { openInitiativeEntry, test, expect, settleMotion } from "./fixtures";

for (const editing of [false, true]) {
  test(`${editing ? "登録済み施策" : "新規施策"}の上段に施策名・備考、下段に分類欄を配置する`, async ({ page, app }, testInfo) => {
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
      if (width >= 900) {
        expect(noteBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
        expect(noteBox.y).toBe(nameBox.y);
      } else expect(noteBox.y).toBeGreaterThanOrEqual(nameBox.y);
      if (!editing) {
        const register = (await app.getByRole("button", { name: "登録", exact: true }).boundingBox())!;
        if (width >= 900) {
          expect(register.x).toBeGreaterThan(noteBox.x + noteBox.width);
          expect(register.y).toBe(noteBox.y);
        } else expect(register.y).toBeGreaterThanOrEqual(noteBox.y);
      }
      const text = (await app.locator(".initiative-text-fields").boundingBox())!;
      const slots = (await app.locator(".initiative-classification-fields").boundingBox())!;
      expect(slots.x).toBe(text.x);
      expect(slots.y).toBeGreaterThanOrEqual(text.y + text.height);
      expect(await app.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await expect(note).toHaveValue(originalNote);
      if (width === 1920 || width === 600) await testInfo.attach(`施策入力-${editing ? "編集" : "新規"}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  });
}
