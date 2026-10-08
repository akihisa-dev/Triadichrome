import packageInfo from "../../package.json" with { type: "json" };
import { test, expect } from "./fixtures";

const { version } = packageInfo;

test("アプリ名の右横に現在のバージョンを入口と共通ヘッダーで表示する", async ({ app }) => {
  const entryVersion = app.locator(".entry-brand .app-version");
  await expect(entryVersion).toHaveText(`v${version}`);
  await expect(entryVersion).toHaveAttribute("aria-label", `バージョン ${version}`);
  const title = (await app.locator(".entry-title").boundingBox())!;
  const entry = (await entryVersion.boundingBox())!;
  expect(entry.x).toBeGreaterThanOrEqual(title.x + title.width);
  expect(entry.y).toBeLessThan(title.y + title.height);

  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  const headerVersion = app.locator(".home-brand .app-version");
  await expect(headerVersion).toHaveText(`v${version}`);
  await expect(headerVersion).toHaveAttribute("aria-label", `バージョン ${version}`);
  const header = (await headerVersion.boundingBox())!;
  const fiscalYear = (await app.locator(".home-fiscal-year").boundingBox())!;
  expect(fiscalYear.x).toBeGreaterThanOrEqual(header.x + header.width);

  await app.getByRole("complementary", { name: "メニュー" }).getByRole("button", { name: "施策一覧", exact: true }).click();
  await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  await expect(headerVersion).toHaveText(`v${version}`);
});
