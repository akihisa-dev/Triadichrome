import { test, expect } from "./fixtures";
import { mechanisms } from "../../Triadichrome-extension/src/extension/mechanismModel";

test("仕組みの全対象を閲覧し、条件・保存範囲を確認して業務の関連図へ戻る", async ({ app, page }) => {
  await page.goto("/tests/ui/preview.html?data=full");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  for (const [kind, label] of [["calculation", "計算の仕組み"], ["process", "処理の流れ"]] as const) {
    await app.getByRole("button", { name: label, exact: true }).press("Enter");
    const view = app.getByRole("region", { name: label, exact: true });
    for (const topic of mechanisms.filter(topic => topic.kind === kind)) {
      await view.getByRole("navigation").getByRole("button", { name: topic.name, exact: true }).click();
      await expect(view.getByRole("heading", { name: topic.name, exact: true })).toBeVisible();
      await expect(view.getByRole("list", { name: `${topic.name}の流れ` })).toBeVisible();
      await expect(view).toContainText(topic.result);
      await expect(view).toContainText(topic.retention);
      await expect(view.getByRole("heading", { name: "条件と例外", exact: true })).toBeVisible();
      expect(await view.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await view.getByText("説明に対応する実装", { exact: true }).click();
    await expect(view.locator(".mechanism-sources ul")).toBeVisible();
    await expect(view).not.toContainText("既存商品の販売拡大");
  }
  await expect(app.getByRole("button", { name: "操作を取り消す", exact: true })).toBeDisabled();
  await app.getByRole("button", { name: "画面とデータ", exact: true }).click();
  await expect(app.getByRole("region", { name: "画面とデータの対応図" })).toBeVisible();
  await app.getByRole("button", { name: "関連図", exact: true }).click();
  await expect(app.getByRole("region", { name: "画面とマスタの相関図" })).toBeVisible();
  await app.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("button", { name: "履歴", exact: true }).click();
  await expect(app.locator(".history-date")).toHaveCount(3);
});
