# Chrome Web Store 掲載画像

そのままアップロードできるPNGを8枚用意しています。`preview.png`は確認用の一覧で、アップロード用ではありません。

| 掲載欄 | ファイル | 寸法 | 必須・任意 |
| --- | --- | --- | --- |
| ストアアイコン | [icon-128.png](icon-128.png) | 128×128 | 必須。拡張機能の配布物にも同梱 |
| 小型の販促画像 | [promo-small-440x280.png](promo-small-440x280.png) | 440×280 | 必須 |
| 大型の販促画像 | [promo-marquee-1400x560.png](promo-marquee-1400x560.png) | 1400×560 | 任意の掲載枠用 |
| スクリーンショット1 | [入口](screenshots/01-entry-1280x800.png) | 1280×800 | スクリーンショットは最低1枚、最大5枚 |
| スクリーンショット2 | [新規作成](screenshots/02-create-1280x800.png) | 1280×800 | 同上 |
| スクリーンショット3 | [ドラッグ操作](screenshots/03-drop-1280x800.png) | 1280×800 | 同上 |
| スクリーンショット4 | [ファイルメニュー](screenshots/04-menu-1280x800.png) | 1280×800 | 同上 |
| スクリーンショット5 | [形式の案内](screenshots/05-validation-1280x800.png) | 1280×800 | 同上 |

スクリーンショットは番号順に登録します。画像に宣伝文句や説明帯は付けていません。販促画像はロゴと製品名のみです。アイコンは透過PNG、販促画像とスクリーンショットは透過のないRGB PNGです。

寸法・枚数は[Chrome公式の画像要件](https://developer.chrome.com/docs/webstore/images)、構成は[掲載画像の品質指針](https://developer.chrome.com/docs/webstore/best-listing)に基づきます。

## ロゴ

[ロゴの正本PNG](../branding/logo.png)は、濃いグレーの角丸背景に三つの白い面を配置した文字なしの画像です。角丸の外側だけを透過し、背景と白い図形を残しています。

正本と同じ比率・透明余白を保った[512px](../branding/logo-512.png)・[1024px](../branding/logo-1024.png)透過PNGと、拡張機能用の16・32・48・128px PNGを`branding/`に収めています。

販促画像も無彩色とし、背景の装飾は付けていません。ロゴのPNGと販促画像のHTMLを編集用の正本とします。既存の販促画像・スクリーンショットは旧ロゴを含むため、掲載時には再生成してください。

## 画面の出典と範囲

`source/screenshots/`は、このリポジトリのReact画面をローカルで動かして1280×800pxで撮影した画像です。掲載用は同じ画素を使い、PNGの形式だけRGBに揃えています。描き足し・引き伸ばし・角丸処理はしていません。

撮影対象は入口、キーボードで新規作成ボタンを選択した状態、ファイルのドラッグ受付中、有効なファイルを読み込んだ後のメニュー、対応外の拡張子を選択した際の案内です。OSの保存ダイアログは収録していません。撮影用ファイルはアプリの作成処理から生成した空の計画であり、個人情報や業務データを含みません。

現在のホーム本文は空白です。施策入力・計画編集・明細・総原価表・展開表は未実装のため、画像には含めていません。撮影はローカルWeb表示で行い、Chrome拡張機能としての読み込み確認とは区別しています。

## 再生成

通常の`npm run build`には画像制作用の追加依存は不要です。`branding/icons/`のPNGを拡張機能へコピーし、Manifestの参照先を確認します。ロゴを変更した場合は、先に画像を書き出してください。

画像制作スクリプトはNode.js、Playwright、sharp、Chromium系ブラウザーを使います。画像制作用の別ディレクトリに依存を置く例です。

```sh
npm install --prefix /tmp/triadichrome-art-tools --no-save playwright@1.62.1 sharp@0.35.4
export TRIADICHROME_ART_MODULES=/tmp/triadichrome-art-tools/node_modules
```

macOSで既存のChromeを使う場合は、次を指定します。省略時はPlaywrightが管理するChromiumを使うため、そのブラウザーを別途用意してください。

```sh
export TRIADICHROME_ART_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

画面を更新するときだけ、別のターミナルで`npm run dev -- --host 127.0.0.1`を実行してから撮影します。

```sh
node scripts/capture-store-screenshots.mjs
```

ロゴ・販促画像のレイアウトは`branding/logo.png`と`store-assets/source/layouts.html`を編集し、次のコマンドでPNGと確認用一覧を再生成します。再生成時は既存の制作画像を上書きします。

```sh
node scripts/render-store-assets.mjs
npm run build
```

ロゴとアイコンだけを書き出す場合は`node scripts/render-store-assets.mjs --icons-only`を使います。この場合はsharpのみ必要で、ブラウザーを起動せず、販促画像・スクリーンショット・確認用一覧を変更しません。

`TRIADICHROME_CAPTURE_URL`で撮影先を変更できます。撮影処理はViteからTypeScriptのファイル作成処理を読み込むため、撮影先にはこのリポジトリのローカル開発サーバーを指定してください。日本語フォントにはmacOSのHiragino Sansを使用し、OSが異なる場合は文字の形や幅が変わることがあります。
