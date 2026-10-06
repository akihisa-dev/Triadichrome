import { test, expect, settleMotion } from "./fixtures";

test("グラフの全画面への入口と、1回クリック・キーボードの画面移動", async ({ app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
  const navigation = app.getByRole("navigation", { name: "メインナビゲーション" });
  const screenNames = (await navigation.getByRole("button").allTextContents()).map(name => name.trim()).filter(name => name !== "Home" && name !== "マスタ" && name !== "履歴");
  await navigation.getByRole("button", { name: "マスタ", exact: true }).click();
  await expect(app.locator(".master-menu-item strong").first()).toBeVisible();
  const masterNames = await app.locator(".master-menu-item strong").allTextContents();
  const destinations = [...masterNames, ...screenNames];
  await navigation.getByRole("button", { name: "Home", exact: true }).click();
  for (const name of destinations) {
    const home = app.getByRole("main", { name: "ホーム", exact: true });
    await settleMotion(app.locator("body"));
    await home.getByRole("button", { name: "全体表示", exact: true }).click();
    await expect(home.locator(".home-relation-node")).toHaveCount(destinations.length);
    expect((await home.locator(".home-relation-node").allTextContents()).sort()).toEqual([...destinations].sort());
    await home.getByRole("button", { name, exact: true }).locator(".home-relation-name").click();
    await expect(app.getByRole("heading", { name, exact: true })).toBeVisible();
    if (name === "施策入力") {
      await settleMotion(app.locator("body"));
      await app.getByRole("textbox", { name: "施策名", exact: true }).fill("グラフからの入力保持");
      await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("グラフからの入力保持");
    }
    await navigation.getByRole("button", { name: "Home", exact: true }).click();
  }
  await app.getByRole("main", { name: "ホーム", exact: true }).getByRole("button", { name: "施策入力", exact: true }).press("Enter");
  await expect(app.getByRole("textbox", { name: "施策名", exact: true })).toHaveValue("グラフからの入力保持");
});

test("自由なドラッグに接続線と周囲が追従し、離しても元の配置へ飛び戻らない", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  const input = home.getByRole("button", { name: "施策入力", exact: true });
  const map = home.locator(".home-relations-map");
  const camera = await map.getAttribute("style");
  const box = (await input.boundingBox())!;
  const icon = (await input.locator(".home-relation-icon").boundingBox())!;
  const center = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 };
  const line = home.locator(".home-relation").filter({ hasText: "科目を選択" }).locator("path").first();
  const path = await line.getAttribute("d");
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 90, center.y + 30, { steps: 6 });
  const dragged = (await input.boundingBox())!;
  expect(dragged.x - box.x).toBeGreaterThan(80);
  await expect(line).not.toHaveAttribute("d", path!);
  await expect(map).toHaveAttribute("style", camera!);
  await page.mouse.up();
  await expect(home).toBeVisible();
  const released = (await input.boundingBox())!;
  expect(Math.abs(released.x - dragged.x)).toBeLessThan(15);
  const sample = await home.locator('.home-relation-item:has([data-page="industry-master"])').evaluate(async node => {
    const before = node.getBoundingClientRect().x;
    const start = performance.now();
    while (performance.now() - start < 400) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return Math.abs(node.getBoundingClientRect().x - before);
  });
  expect(sample).toBeGreaterThan(.1);
  await input.locator(".home-relation-name").click();
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
});

test("背景のドラッグ・ズーム・現在の配置への全体表示と画面往復での保持", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  const map = home.locator(".home-relations-map");
  await settleMotion(app.locator("body"));
  const original = await map.getAttribute("style");
  const bounds = (await viewport.boundingBox())!;
  await page.mouse.move(bounds.x + 5, bounds.y + 5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 45, bounds.y + 35, { steps: 5 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("style", original!);
  await viewport.focus();
  await viewport.press("+");
  await map.evaluate(async node => {
    let previous = "", stable = 0;
    const start = performance.now();
    while (stable < 3 && performance.now() - start < 2000) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const current = node.getAttribute("style")!;
      stable = current === previous ? stable + 1 : 0;
      previous = current;
    }
  });
  const saved = await map.getAttribute("style");
  await home.getByRole("button", { name: "施策入力", exact: true }).press("Space");
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "Home", exact: true }).click();
  await settleMotion(app.locator("body"));
  await expect(map).toHaveAttribute("style", saved!);
  await home.getByRole("button", { name: "全体表示", exact: true }).click();
  await expect.poll(() => viewport.evaluate(viewport => {
    const box = viewport.getBoundingClientRect();
    return [...viewport.querySelectorAll(".home-relation-node")].every(node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom;
    });
  })).toBe(true);
});

test("ホバーとフォーカスで直接の関係を強調し、説明サブノードを常時表示する", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  await expect(home.locator(".home-relation-icon svg")).toHaveCount(13);
  await expect(home.locator(".home-relation-subnode")).toHaveCount(15);
  await expect(home.locator(".home-relation path")).toHaveCount(30);
  await expect(home.locator(".home-relation-subnode").filter({ hasText: /^科目を選択$/ })).toBeVisible();
  const input = home.getByRole("button", { name: "施策入力", exact: true });
  const sizes = await home.locator(".home-relation-icon svg").evaluateAll(icons => icons.map(icon => ({ entry: !!icon.closest(".is-entry"), width: Number.parseFloat(getComputedStyle(icon).width) })));
  expect(sizes.filter(icon => icon.entry)[0]!.width).toBeGreaterThan(Math.max(...sizes.filter(icon => !icon.entry).map(icon => icon.width)));
  await input.locator(".home-relation-icon").hover();
  await expect(home.locator(".home-relation.is-active")).toHaveCount(10);
  await input.focus();
  await expect(home.locator(".home-relation.is-active")).toHaveCount(10);
  await expect(home.locator(".home-relation > title")).toHaveCount(15);
  await expect(home.locator(".home-relation text, .home-relation rect")).toHaveCount(0);
  const blue = await home.locator(".home-relation-node, .home-relation path").evaluateAll(nodes => nodes.some(node => {
    const style = getComputedStyle(node);
    return [style.color, style.stroke, style.backgroundColor].includes("rgb(0, 51, 255)");
  }));
  expect(blue).toBe(false);
});

test("ズームは中間倍率を通り、途中反転しても連続する", async ({ app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  const map = home.locator(".home-relations-map");
  const scale = () => map.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).a);
  const initial = await scale();
  await home.getByRole("button", { name: "拡大", exact: true }).click();
  const frames = await map.evaluate(async node => {
    const values: number[] = [];
    for (let i = 0; i < 8; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      values.push(new DOMMatrix(getComputedStyle(node).transform).a);
    }
    return values;
  });
  expect(frames.some(value => value > initial && value < initial * 1.25 - .001)).toBe(true);
  expect(new Set(frames).size).toBeGreaterThan(2);
  const before = await scale();
  await home.getByRole("button", { name: "縮小", exact: true }).click();
  expect(Math.abs(await scale() - before)).toBeLessThan(initial * .08);
  await expect.poll(scale).toBeCloseTo(initial, 3);
});

test("タッチのピンチで拡大し、項目を誤って開かない", async ({ page, app, context }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  const map = home.locator(".home-relations-map");
  const initial = await map.getAttribute("style");
  const box = (await home.getByRole("region", { name: "画面とマスタの相関図" }).boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  const touches = (distance: number) => [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }];
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches(20) });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touches(40) });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(home).toBeVisible();
  await expect(map).not.toHaveAttribute("style", initial!);
  await session.detach();
});

test("動きを減らす設定でも項目は自由に動かせ、移動後の操作を保持する", async ({ page, app }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  const input = home.getByRole("button", { name: "施策入力", exact: true });
  const box = (await input.boundingBox())!;
  const icon = (await input.locator(".home-relation-icon").boundingBox())!;
  await page.mouse.move(icon.x + icon.width / 2, icon.y + icon.height / 2);
  await page.mouse.down();
  await page.mouse.move(icon.x + icon.width / 2 + 80, icon.y + icon.height / 2, { steps: 5 });
  expect((await input.boundingBox())!.x - box.x).toBeGreaterThan(70);
  await page.mouse.up();
  await expect(home).toBeVisible();
  await input.press("Enter");
  await expect(app.getByRole("heading", { name: "施策入力", exact: true })).toBeVisible();
});


test("関係サブノードを動かすと両側の線が追従し、画面を開かない", async ({ page, app }) => {
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  await settleMotion(app.locator("body"));
  const relation = home.locator(".home-relation").filter({ hasText: "科目を選択" });
  const subnode = relation.locator(".home-relation-subnode");
  await subnode.hover({ force: true });
  await expect(home.locator(".home-relation.is-active")).toHaveCount(1);
  const before = await relation.locator("path").evaluateAll(paths => paths.map(path => path.getAttribute("d")));
  const box = (await subnode.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 30, { steps: 6 });
  await page.mouse.up();
  await expect(home).toBeVisible();
  await expect.poll(() => relation.locator("path").evaluateAll(paths => paths.map(path => path.getAttribute("d")))).not.toEqual(before);
  await subnode.click();
  await expect(home).toBeVisible();
  await subnode.focus();
  await subnode.press("Enter");
  await expect(home).toBeVisible();
});
