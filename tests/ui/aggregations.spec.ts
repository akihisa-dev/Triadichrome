import { test, expect, settleMotion } from "./fixtures";
import type { FrameLocator } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function master(app: FrameLocator, name: string) {
  await app.getByRole("button", { name: "マスタ", exact: true }).click();
  await app.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

async function addAccount(app: FrameLocator, code: string, name: string, type: string) {
  await app.getByRole("textbox", { name: "科目コード", exact: true }).fill(code);
  await app.getByRole("textbox", { name: "科目名", exact: true }).fill(name);
  await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption(type);
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("button", { name: `${name}を編集`, exact: true })).toBeEnabled();
}

async function configure(app: FrameLocator, group: string, members: [string, string][]) {
  await app.getByRole("button", { name: `${group}を編集`, exact: true }).click();
  for (const [index, [label, sign]] of members.entries()) {
    await app.getByRole("button", { name: "＋ 対象を追加", exact: true }).click();
    await app.getByRole("combobox", { name: `${index + 1}番目の集計対象`, exact: true }).selectOption({ label });
    await app.getByRole("combobox", { name: `${index + 1}番目の加減算`, exact: true }).selectOption(sign);
  }
  await app.getByRole("button", { name: "保存", exact: true }).click();
  await expect(app.getByRole("button", { name: `${group}を編集`, exact: true })).toBeEnabled();
}

test("集計の加減算・重複防止と総原価表を保存し、科目のドラッグ順序を反映する", async ({ app, page }, testInfo) => {
  test.setTimeout(60_000);
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await expect(app.getByRole("navigation").getByRole("button")).toHaveText(["Home", "施策入力", "施策一覧", "総原価表", "マスタ"]);
  await master(app, "勘定科目マスタ");
  for (const [code, name, type] of [["100", "売上科目1", "sales"], ["200", "原価科目1", "cost"], ["500", "費用科目1", "expense"], ["900", "利益科目1", "profit"]] as const) await addAccount(app, code, name, type);
  await master(app, "集計マスタ");
  for (const name of ["売上集計", "費用集計", "営業利益", "経常利益"]) await expect(app.getByRole("button", { name: `${name}を削除`, exact: true })).toBeDisabled();
  await app.getByRole("textbox", { name: "集計名", exact: true }).fill("売上小計");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("button", { name: "売上小計を編集", exact: true })).toBeEnabled();
  await configure(app, "売上小計", [["100 売上科目1", "1"]]);
  await configure(app, "売上集計", [["売上小計", "1"], ["200 原価科目1", "-1"]]);
  await configure(app, "費用集計", [["500 費用科目1", "1"]]);
  await configure(app, "営業利益", [["売上集計", "1"], ["費用集計", "-1"]]);
  await configure(app, "経常利益", [["営業利益", "1"], ["900 利益科目1", "1"]]);
  await app.getByRole("button", { name: "売上小計を編集", exact: true }).click();
  await app.getByRole("button", { name: "＋ 対象を追加", exact: true }).click();
  const options = app.getByRole("combobox", { name: "2番目の集計対象", exact: true });
  for (const label of ["100 売上科目1", "売上小計（所属済み）", "売上集計（所属済み）", "営業利益（所属済み）", "経常利益", "500 費用科目1（所属済み）"]) {
    await expect(options.getByRole("option", { name: label, exact: true })).toBeDisabled();
  }
  await app.getByRole("button", { name: "キャンセル", exact: true }).click();
  await settleMotion(app.locator("body"));
  await page.screenshot({ path: join(tmpdir(), `triadichrome-aggregation-${testInfo.project.name}.png`) });
  for (const [name, amounts] of [["施策A", ["100", "30", "20", "10"]], ["施策B", ["25.5", "0", "-5", "0"]]] as const) {
    await app.getByRole("button", { name: "施策入力", exact: true }).click();
    await app.getByRole("textbox", { name: "施策名", exact: true }).fill(name);
    await app.getByRole("spinbutton", { name: "年度", exact: true }).fill("2026");
    for (const [index, label] of ["100 売上科目1", "200 原価科目1", "500 費用科目1", "900 利益科目1"].entries()) {
      if (index) await app.getByRole("button", { name: "＋ 勘定科目を追加", exact: true }).click();
      await app.getByRole("combobox", { name: `${index + 1}行目の勘定科目`, exact: true }).selectOption({ label });
      await app.getByRole("table", { name: "月別計画金額", exact: true }).getByRole("row").nth(index + 1).getByRole("spinbutton").nth(0).fill(amounts[index]!);
    }
    await app.getByRole("spinbutton", { name: "売上科目1 5月の金額", exact: true }).fill("0");
    await app.getByRole("button", { name: "登録", exact: true }).click();
    await expect(app.getByRole("heading", { name: "施策一覧", exact: true })).toBeVisible();
  }
  await app.getByRole("button", { name: "総原価表", exact: true }).click();
  const table = app.getByRole("table", { name: "総原価表", exact: true });
  await expect(table.getByRole("rowheader")).toHaveText(["売上科目1", "売上小計", "原価科目1", "売上集計", "費用科目1", "費用集計", "営業利益", "利益科目1", "経常利益"]);
  const ordinary = table.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "経常利益", exact: true }) });
  await expect(ordinary.getByRole("cell").nth(0)).toHaveText("");
  await expect(ordinary.getByRole("cell").nth(1)).toHaveText("90.5");
  await expect(ordinary.getByRole("cell").nth(3)).toHaveText("0");
  await expect(ordinary.getByRole("cell").nth(5)).toHaveText("");
  await app.locator(".home-header button").click();
  await settleMotion(app.locator("body"));
  expect(await app.locator(".home-content").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  const region = app.getByRole("region", { name: "総原価表の月別前年・予算", exact: true });
  const left = (await ordinary.getByRole("rowheader").boundingBox())!.x;
  await region.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  expect((await ordinary.getByRole("rowheader").boundingBox())!.x).toBe(left);
  await region.evaluate(node => { node.scrollLeft = 0; });
  await page.screenshot({ path: join(tmpdir(), `triadichrome-cost-${testInfo.project.name}.png`) });
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await master(app, "勘定科目マスタ");
  await app.locator(".home-header button").click();
  const handle = app.getByRole("button", { name: "費用科目1を並べ替え", exact: true });
  const destination = app.getByRole("row").filter({ has: app.getByRole("rowheader", { name: "売上科目1", exact: true }) });
  await settleMotion(app.locator("body"));
  await handle.dragTo(destination, { targetPosition: { x: 20, y: 5 } });
  await expect(app.getByRole("rowheader")).toHaveText(["費用科目1", "売上科目1", "原価科目1", "利益科目1"]);
  await expect(handle).toBeEnabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await handle.press("ArrowDown");
  await expect(app.getByRole("rowheader")).toHaveText(["売上科目1", "費用科目1", "原価科目1", "利益科目1"]);
  await settleMotion(app.locator("body"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await app.getByRole("button", { name: "総原価表", exact: true }).click();
  await expect(table.getByRole("rowheader")).toHaveText(["売上科目1", "売上小計", "費用科目1", "費用集計", "原価科目1", "売上集計", "営業利益", "利益科目1", "経常利益"]);
  await expect(ordinary.getByRole("cell").nth(1)).toHaveText("90.5");
});

test("集計の保存失敗で入力と必須集計を保持する", async ({ app, page }) => {
  await page.getByRole("combobox", { name: "ファイル操作", exact: true }).selectOption("save-failure");
  await expect(page.getByRole("status")).toHaveText("操作できます");
  await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await app.getByRole("button", { name: "サイドバーを開く" }).click();
  await master(app, "集計マスタ");
  await app.getByRole("textbox", { name: "集計名", exact: true }).fill("保存待ち");
  await app.getByRole("button", { name: "登録", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");
  await expect(app.getByRole("textbox", { name: "集計名", exact: true })).toHaveValue("保存待ち");
  await expect(app.getByRole("rowheader")).toHaveCount(4);
  await app.getByRole("button", { name: "営業利益を編集", exact: true }).click();
  await app.getByRole("button", { name: "＋ 対象を追加", exact: true }).click();
  await app.getByRole("combobox", { name: "1番目の集計対象", exact: true }).selectOption({ label: "売上集計" });
  await app.getByRole("button", { name: "保存", exact: true }).click();
  await expect(app.getByRole("alert")).toHaveText("テスト用の保存失敗です。");
  await expect(app.getByRole("combobox", { name: "1番目の集計対象", exact: true })).toHaveValue("group:1");
  await app.getByRole("button", { name: "キャンセル", exact: true }).click();
  await app.getByRole("button", { name: "総原価表", exact: true }).click();
  await expect(app.getByText("営業利益未設定", { exact: true })).toBeVisible();
});
