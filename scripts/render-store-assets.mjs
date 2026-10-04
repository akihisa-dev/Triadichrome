import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// 制作専用の依存は、通常の拡張機能ビルドから分離して解決します。
const require = createRequire(process.env.TRIADICHROME_ART_MODULES
  ? path.join(path.resolve(process.env.TRIADICHROME_ART_MODULES), "package.json")
  : import.meta.url);
const sharp = require("sharp");
const iconsOnly = process.argv.includes("--icons-only");
const root = path.resolve(import.meta.dirname, "..");
const store = path.join(root, "store-assets");
const logo = path.join(root, "branding", "logo.png");
const assets = [
  ["promo-small", "promo-small-440x280.png", 440, 280],
  ["promo-marquee", "promo-marquee-1400x560.png", 1400, 560],
  ...["entry", "create", "drop", "menu", "validation"].map((name, i) => [
    `screenshot-0${i + 1}`, `screenshots/0${i + 1}-${name}-1280x800.png`, 1280, 800,
  ]),
];
await fs.mkdir(path.join(root, "branding", "icons"), { recursive: true });
for (const size of [16, 32, 48, 128, 512, 1024]) {
  const target = size <= 128
    ? path.join(root, "branding", "icons", `icon-${size}.png`)
    : path.join(root, "branding", `logo-${size}.png`);
  await sharp(logo)
    .resize(size, size).png().toFile(target);
  const meta = await sharp(target).metadata();
  assert.equal(meta.width, size); assert.equal(meta.height, size);
  assert.equal(meta.hasAlpha, true);
}
await fs.copyFile(path.join(root, "branding", "icons", "icon-128.png"), path.join(store, "icon-128.png"));
if (iconsOnly) {
  console.log("Logo exports verified: transparent PNGs at 16, 32, 48, 128, 512, and 1024px.");
  process.exit(0);
}
await fs.mkdir(path.join(store, "screenshots"), { recursive: true });
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TRIADICHROME_ART_CHROME ? { executablePath: process.env.TRIADICHROME_ART_CHROME } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, locale: "ja-JP" });
  await page.goto(pathToFileURL(path.join(store, "source", "layouts.html")).href);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("img").evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), true);
  for (const [id, filename, width, height] of assets.slice(0, 2)) {
    const screenshot = await page.locator(`#${id}`).screenshot({ animations: "disabled" });
    const target = path.join(store, filename);
    await sharp(screenshot).removeAlpha().png().toFile(target);
    const meta = await sharp(target).metadata();
    assert.equal(meta.width, width); assert.equal(meta.height, height);
    assert.equal(meta.hasAlpha, false); assert.equal(meta.channels, 3);
  }
} finally { await browser.close(); }
// スクリーンショットは実画面の画素を保ち、保存形式だけRGBに揃えます。
for (const [, filename, width, height] of assets.slice(2)) {
  const source = path.join(store, "source", filename.replace("-1280x800", ""));
  const meta = await sharp(source).metadata();
  assert.equal(meta.width, width); assert.equal(meta.height, height);
  await sharp(source).removeAlpha().png().toFile(path.join(store, filename));
}
// この一覧は確認用で、ストアへのアップロード対象には含めません。
const thumbs = [
  ["promo-small-440x280.png", 32, 32, 440, 280],
  ["promo-marquee-1400x560.png", 496, 32, 700, 280],
  ...assets.slice(2).map(([, filename], i) => [filename, 32 + (i % 2) * 596, 344 + Math.floor(i / 2) * 380, 576, 360]),
];
const composite = await Promise.all(thumbs.map(async ([file, left, top, width, height]) => ({
  input: await sharp(path.join(store, file)).resize(width, height).toBuffer(), left, top,
})));
await sharp({ create: { width: 1228, height: 1484, channels: 3, background: "#e5e5e5" } })
  .composite(composite).png().toFile(path.join(store, "preview.png"));
console.log("Store assets verified: icon, 2 promotional images, 5 screenshots; extension icons and logo exports.");
