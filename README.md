# Triadichrome

施策を起点に計画を作り、明細・総原価表・展開表で同じデータを確認するChrome拡張機能です。
現在の実装は、`.triadic`ファイルを開く入口画面、ホーム画面、施策入力画面の3画面です。入口では「ファイルを開く」「新規作成」とファイルのドロップを扱います。点線の枠内にドロップの案内と対応形式を表示し、ドラッグ中は枠を強調します。画面左上のハンバーガーボタンでサイドバーを開き、「Home」と、その下の「施策入力」で画面を切り替えられます。選択するとサイドバーが閉じ、開き直すと表示中の画面の項目を強調します。サイドバーには計画のファイル名を表示します。サイドバーは閉じるボタン・背景クリック・Escキーでも閉じられます。「ファイルを閉じる」で入口へ戻り、ファイルを開くとホームから開始します。ホームの本文領域は空白で、施策入力画面は見出しのみです。入力項目・計画編集機能と明細・総原価表・展開表の画面はまだありません。

## 保存形式の方針

計画は専用の `.triadic` ファイルで管理します。新規作成時の初期ファイル名は `Untitled.triadic` です。一つのファイルで一つの計画を扱い、中身は標準的なSQLiteデータベースとします。JSON・CSV・Excelを保存形式には使用しません。

施策・勘定科目・年月と計画金額を同じデータとして持ち、明細・総原価表・展開表はそのデータを異なる視点で表します。集計結果を別の正本として重複保存しません。現在はファイルの新規作成と形式検証を伴う読込を実装しています。

## 開発

Node.js 20.19以上とnpmを使用します。

```sh
npm install
npm run dev
npm run typecheck
npm run build
```

TypeScript、React、Vite、sql.js、Chrome Extension Manifest V3を使用します。
`npm run build`は型チェック後に一時領域でビルドし、Manifest・独立ページ・assets・icons・service workerを`Triadichrome-extension/`へ同期します。

## ブラウザでの画面確認・自動テスト

`npm run dev:ui`で起動し、[画面テスト用の入口](http://127.0.0.1:4173/tests/ui/preview.html)を開きます。Codex内のブラウザでも操作できます。「ファイルを開く」は空のテスト計画を読み込み、「新規作成」はメモリ内に計画を作ります。実ファイルの選択や書き込みは行いません。上部の選択欄でキャンセル・不正ファイル・保存失敗を再現でき、「入口に戻す」または再読み込みでテストデータを初期化します。

表示領域には通常のアプリ入口をそのまま読み込みます。画面部品・CSS・SQLiteの作成と検証は製品と共通で、ファイル選択・保存の境界だけを`tests/ui/memory-files.ts`で置き換えています。アプリの変更は開発サーバーから反映されます。テスト用コードは配布用ビルドの入口に含めません。

```sh
# 初回のみ：テスト用ブラウザの準備
npx playwright install chromium

# ビルド後、広い画面と狭い画面でテスト
npm run test:ui

# 操作結果・画面画像・失敗時の記録を確認
npm run test:ui:report
```

手元にインストール済みのChromeを使う場合は、macOS/Linuxでは`TRIADICHROME_TEST_BROWSER=chrome npm run test:ui`でも実行できます。ブラウザの種類を省略した場合はPlaywrightのChromiumを使います。

入口からホームへの移動、計画作成と再読込、サイドバーの開閉・キーボード操作、ホームと施策入力の往復・選択中の項目表示、キャンセル・読込失敗・保存失敗を確認します。さらに、確認用画面とビルドされた配布用画面を同じ寸法・テストデータで操作し、入口・ホーム・サイドバーの操作対象と画像が一致することを検証します。描画の微小な色差と輪郭処理の差を除外し、判定対象の差分画素数は0を要求します。過去画像との比較ではなく、同じ実装から生成した両画面の一致を確認するため、デザインの良し悪しは保存された画像を見て判断します。

`playwright-report/`には結果と画像、`test-results/ui/`には失敗時の画像と操作記録を出力し、Gitには含めません。自動テストはポート4174の専用サーバーを起動・終了するため、ポート4173の手動確認画面と併用できます。Chrome拡張のアイコン起動・権限・service worker・実ファイルへの保存は、この画面テストの対象外です。起動管理には[Playwrightの開発サーバー設定](https://playwright.dev/docs/test-webserver)を使用しています。

## Chromeで読み込む

1. `npm run build`を実行します。
2. Chromeの拡張機能管理画面でデベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」で`Triadichrome-extension/`を選択します。
4. 拡張機能のアイコンを押すと、ファイルを開く入口画面が開きます。

変更後は再ビルドし、拡張機能管理画面で更新してください。

## ストア掲載画像

Chrome Web Store用のアイコン・販促画像2種類・スクリーンショット5枚を`store-assets/`に用意しています。掲載先との対応と再生成手順は[掲載画像ガイド](store-assets/README.md)、画像の一覧は[プレビュー](store-assets/preview.png)を参照してください。
ロゴの正本は`branding/logo.svg`です。アプリと同じモノクロミニマルな配色で、三つの多角形によって書類のモチーフを表現しています。拡張機能用のPNGを`branding/icons/`からビルド時に同期します。
入口とホームのヘッダーには同じSVGを表示し、ブラウザーのタブにもアイコンを設定しています。

## 構成

- `Triadichrome-extension/src/extension/ExtensionPage.tsx`：ファイル操作と入口画面
- `Triadichrome-extension/src/extension/HomePage.tsx`：共通ヘッダー・開閉式サイドバーと画面切り替え
- `Triadichrome-extension/src/extension/InitiativeEntryPage.tsx`：施策入力画面
- `Triadichrome-extension/src/extension/ExtensionPage.css`：入口とホーム画面のスタイル
- `Triadichrome-extension/src/extension/main.tsx`：Reactの起動
- `Triadichrome-extension/src/extension/background.ts`：拡張機能アイコンから入口を開く処理
- `Triadichrome-extension/manifest.template.json`：Manifestの正本
- `scripts/build.mjs`：ビルドと生成物の同期
- `dist/`：ビルド用の一時領域。コミット対象外

開発・検証・コミットのルールは[AGENTS.md](AGENTS.md)を参照してください。
