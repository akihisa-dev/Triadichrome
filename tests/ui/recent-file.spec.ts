import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { settleMotion } from "./fixtures";

const sample = Array.from(await readFile(new URL("../../samples/全機能確認用.triadic", import.meta.url)));

// Real structured-cloneable handles, confined to this test browser's storage.
async function filePicker(page: Page, name = "再開テスト.triadic", bytes = sample) {
  await page.evaluate(async ({ name, bytes }) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
    Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: async () => [handle] });
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: async () => handle });
  }, { name, bytes });
}

async function closeFile(page: Page) {
  await page.getByRole("button", { name: "ファイルを閉じる", exact: true }).click();
  await page.getByRole("alertdialog", { name: "ファイルを閉じる", exact: true }).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Triadichrome", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#recent-file-name")).toHaveText("前回のファイルはありません");
  await expect(page.getByRole("button", { name: "続きから", exact: true })).toBeDisabled();
});

test("再読み込み後に記憶したファイルを開き、最新の内容を読み直す", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await filePicker(page);
  await page.getByRole("button", { name: "新規作成", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
  await closeFile(page);
  // Replace the empty plan externally, after closing it.
  await filePicker(page);
  await page.addInitScript(() => {
    let reads = 0;
    const original = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = function () { reads++; return original.call(this); };
    Object.defineProperty(window, "fileReadCount", { get: () => reads });
  });
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("再開テスト.triadic");
  expect(await page.evaluate(() => Reflect.get(window, "fileReadCount"))).toBe(0);
  await settleMotion(page.locator("body"));
  await testInfo.attach("続きから・記憶あり", { body: await page.screenshot(), contentType: "image/png" });
  expect(await page.locator("html").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
  await page.getByRole("button", { name: "マスタ", exact: true }).click();
  await page.getByRole("button", { name: /^勘定科目マスタ/ }).click();
  await expect(page.getByRole("button", { name: "売上高を編集", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("最後の1件で置き換え、記憶の消去はファイルを削除しない", async ({ page }) => {
  for (const name of ["最初.triadic", "次の計画.triadic"]) {
    await filePicker(page, name);
    await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
    await closeFile(page);
  }
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("次の計画.triadic");
  await page.getByRole("button", { name: "記憶を消す", exact: true }).click();
  await expect(page.locator("#recent-file-name")).toHaveText("前回のファイルはありません");
  await expect(page.getByRole("button", { name: "続きから", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("前回のファイルはありません");
  expect(await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    return (await (await root.getFileHandle("次の計画.triadic")).getFile()).size;
  })).toBe(sample.length);
});

test("不正ファイルと選択キャンセルでは前回の記憶を置き換えない", async ({ page }) => {
  await filePicker(page);
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await closeFile(page);
  await filePicker(page, "不正.triadic", [1, 2, 3]);
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("読み込めません");
  await page.evaluate(() => Object.defineProperty(window, "showOpenFilePicker", {
    value: async () => { throw new DOMException("cancel", "AbortError"); },
  }));
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("再開テスト.triadic");
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
});

test("削除・破損・許可拒否の案内を出し、通常の選択で復帰できる", async ({ page }) => {
  await filePicker(page);
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await closeFile(page);
  await page.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry("再開テスト.triadic"));
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("前回のファイルが見つかりません");
  await filePicker(page, "復帰.triadic");
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await closeFile(page);
  await filePicker(page, "復帰.triadic", [1, 2, 3]);
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("読み込めません");
  await page.evaluate(() => {
    Object.defineProperty(FileSystemFileHandle.prototype, "queryPermission", { configurable: true, value: async () => "prompt" });
    Object.defineProperty(FileSystemFileHandle.prototype, "requestPermission", { configurable: true, value: async () => "denied" });
  });
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("読み取りが許可されませんでした");
  await expect(page.locator("#recent-file-name")).toHaveText("復帰.triadic");
  await filePicker(page, "別の計画.triadic");
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("別の計画.triadic");
});

test("ドロップからも記憶し、参照のないファイル入力では以前の記憶を消す", async ({ page }) => {
  await filePicker(page);
  await page.locator(".entry-page").evaluate(async element => {
    const handle = await (await navigator.storage.getDirectory()).getFileHandle("再開テスト.triadic");
    const transfer = new DataTransfer();
    transfer.items.add(await handle.getFile());
    Object.defineProperty(DataTransferItem.prototype, "getAsFileSystemHandle", { configurable: true, value: async () => handle });
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("再開テスト.triadic");
  await page.locator('input[type="file"]').setInputFiles({ name: "参照なし.triadic", mimeType: "application/octet-stream", buffer: Buffer.from(sample) });
  await expect(page.locator(".home-file-name")).toHaveText("参照なし.triadic");
  await closeFile(page);
  await expect(page.getByRole("button", { name: "続きから", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator("#recent-file-name")).toHaveText("前回のファイルはありません");
});

test("記憶の保存に失敗しても開けて、その画面内では再開できる", async ({ page }) => {
  await filePicker(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException("storage failure", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "ファイルを開く", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
  await closeFile(page);
  await expect(page.getByRole("status")).toContainText("記憶を保存できませんでした");
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".home-file-name")).toHaveText("再開テスト.triadic");
});
