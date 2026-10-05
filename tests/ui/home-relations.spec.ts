import { test, expect, settleMotion } from "./fixtures";

test("ホームの相関図から全画面へ移動し、入力を保持する", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  const navigation = app.getByRole("navigation", { name: "メインナビゲーション" });
  const screenNames = (await navigation.getByRole("button").allTextContents()).map(name => name.trim()).filter(name => name !== "Home" && name !== "マスタ");
  expect(screenNames.length).toBeGreaterThan(0);
  await navigation.getByRole("button", { name: "マスタ", exact: true }).click();
  await expect(app.getByRole("heading", { name: "マスタ", exact: true })).toBeVisible();
  const masterNames = await app.locator(".master-menu-item strong").allTextContents();
  expect(masterNames.length).toBeGreaterThan(0);
  const destinations = [...masterNames, ...screenNames];
  await navigation.getByRole("button", { name: "Home", exact: true }).click();
  for (const name of destinations) {
    const home = app.getByRole("main", { name: "ホーム", exact: true });
    await settleMotion(app.locator("body"));
    await home.getByRole("button", { name: "全体表示", exact: true }).click();
    await expect(home.locator(".home-relation-node")).toHaveCount(destinations.length);
    expect((await home.locator(".home-relation-node").allTextContents()).sort()).toEqual([...destinations].sort());
    await home.getByRole("button", { name, exact: true }).click();
    await expect(app.getByRole("heading", { name, exact: true })).toBeVisible();
    if (name === "施策入力") await app.getByRole("textbox", { name: "施策名", exact: true }).fill("ホームからの入力保持");
    await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  }
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "施策入力", exact: true }).press("Enter");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("ホームからの入力保持");
});

test("パン・ズームと表示位置の復元、ドラッグとクリックの区別", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  const map = home.locator(".home-relations-map");
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  const initial = await map.getAttribute("style");
  await home.getByRole("button", { name: "拡大", exact: true }).click();
  await expect(map).not.toHaveAttribute("style", initial!);
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  const input = home.getByRole("button", { name: "施策入力", exact: true });
  const box = (await input.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await expect(home).toBeVisible();
  await expect(map).not.toHaveAttribute("style", initial!);
  const panned = await map.getAttribute("style");
  await viewport.focus();
  await viewport.press("+");
  await expect(map).not.toHaveAttribute("style", panned!);
  await input.focus();
  await expect(home.locator(".home-relation.is-active")).toHaveCount(9);
  const saved = await map.getAttribute("style");
  await input.press("Space");
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  await settleMotion(app.locator("body"));
  await expect(map).toHaveAttribute("style", saved!);
  const frame = (await viewport.boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.wheel(0, -80);
  await expect(map).not.toHaveAttribute("style", saved!);
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  await settleMotion(app.locator("body"));
  const bounds = (await viewport.boundingBox())!;
  for (const node of await home.locator(".home-relation-node").all()) {
    const box = (await node.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(box.y).toBeGreaterThanOrEqual(bounds.y);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }
  expect(await app.locator("body").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("タッチのピンチで拡大し、全体表示へ戻せる", async ({ page, app, context }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  const map = home.locator(".home-relations-map");
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  const initial = await map.getAttribute("style");
  const box = (await viewport.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  const touches = (distance: number) => [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }];
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches(20) });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touches(40) });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(home).toBeVisible();
  await expect(map).not.toHaveAttribute("style", initial!);
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  await expect(map).toHaveAttribute("style", initial!);
  await session.detach();
});
