import { test, expect, settleMotion } from "./fixtures";

const blue = "rgb(0, 51, 255)";

test("操作対象だけが青くなり、接続線は控えめな青、名称と説明はモノクロを保つ", async ({ page, app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await settleMotion(app.locator("body"));
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  const target = home.getByRole("button", { name: "施策一覧", exact: true });
  const icon = target.locator(".home-relation-icon");
  const shapes = await icon.locator("svg").innerHTML();
  await icon.hover();
  await expect(icon).toHaveCSS("color", blue);
  const selected = () => home.locator(".home-relation-icon").evaluateAll(icons => icons.filter(icon => getComputedStyle(icon).color === "rgb(0, 51, 255)").length);
  await expect.poll(selected).toBe(1);
  await expect(home.locator(".home-relation.is-active path").first()).toHaveCSS("stroke", blue);
  await expect(home.locator(".home-relation.is-active path").first()).toHaveCSS("stroke-opacity", "0.55");
  const leaked = await home.locator(".home-relation-name, .home-relation-subnode").evaluateAll(nodes => nodes.some(node => {
    const style = getComputedStyle(node);
    return [style.color, style.backgroundColor, style.borderColor].includes("rgb(0, 51, 255)");
  }));
  expect(leaked).toBe(false);
  expect(await icon.locator("svg").innerHTML()).toBe(shapes);
  const bounds = (await viewport.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width - 10, bounds.y + 10);
  await viewport.focus();
  await expect(icon).not.toHaveCSS("color", blue);
  await expect(home.locator(".home-relation.is-active")).toHaveCount(0);
  await target.focus();
  await expect(icon).toHaveCSS("color", blue);
  await expect.poll(selected).toBe(1);
  await viewport.focus();
  await expect.poll(selected).toBe(0);
});

test("ドラッグ中は対象の青と接続線を保持し、終了後に他の項目へ切り替えられる", async ({ page, app }) => {
  await app.getByRole("button", { name: "新規作成", exact: true }).click();
  await settleMotion(app.locator("body"));
  const home = app.getByRole("main", { name: "ホーム", exact: true });
  const viewport = home.getByRole("region", { name: "画面とマスタの相関図" });
  const target = home.getByRole("button", { name: "業種マスタ", exact: true });
  const icon = target.locator(".home-relation-icon");
  const box = (await icon.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 8 });
  await expect(icon).toHaveCSS("color", blue);
  await expect(target).toHaveClass(/is-selected/);
  await expect(home.locator(".home-relation.is-active")).toHaveCount(1);
  await expect(home.locator(".home-relation.is-active path").first()).toHaveCSS("stroke", blue);
  await page.mouse.up();
  await expect(home).toBeVisible();
  await viewport.focus();
  const other = home.getByRole("button", { name: "勘定科目マスタ", exact: true }).locator(".home-relation-icon");
  await other.hover();
  await expect(other).toHaveCSS("color", blue);
  await expect(icon).not.toHaveCSS("color", blue);
});
