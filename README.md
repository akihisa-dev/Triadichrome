# Triadichrome

施策を起点に計画を作り、明細・総原価表・展開表で同じデータを確認するChrome拡張機能です。
現在の実装は、`.triadic`ファイルを開く入口画面とホーム画面の2画面です。入口ではファイルの新規作成・読込・ドロップを扱います。ホーム左上のハンバーガーボタンでサイドバーを開き、「ホーム」と「ファイルを閉じる」を操作できます。サイドバーは閉じるボタン・背景クリック・Escキーで閉じられます。ファイルを閉じると入口へ戻ります。施策入力・明細・総原価表・展開表の画面と計画編集機能はありません。ホームの本文領域は空白です。

## 保存形式の方針

計画は専用の `.triadic` ファイルで管理します。一つのファイルで一つの計画を扱い、中身は標準的なSQLiteデータベースとします。JSON・CSV・Excelを保存形式には使用しません。

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

## Chromeで読み込む

1. `npm run build`を実行します。
2. Chromeの拡張機能管理画面でデベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」で`Triadichrome-extension/`を選択します。
4. 拡張機能のアイコンを押すと、ファイルを開く入口画面が開きます。

変更後は再ビルドし、拡張機能管理画面で更新してください。

## ストア掲載画像

Chrome Web Store用のアイコン・販促画像2種類・スクリーンショット5枚を`store-assets/`に用意しています。掲載先との対応と再生成手順は[掲載画像ガイド](store-assets/README.md)、画像の一覧は[プレビュー](store-assets/preview.png)を参照してください。
ロゴの正本は`branding/logo.svg`です。三つの多角形で書類のモチーフを表現し、拡張機能用のPNGを`branding/icons/`からビルド時に同期します。

## 構成

- `Triadichrome-extension/src/extension/ExtensionPage.tsx`：ファイル操作と入口画面
- `Triadichrome-extension/src/extension/HomePage.tsx`：ホーム画面と開閉式サイドバー
- `Triadichrome-extension/src/extension/ExtensionPage.css`：入口とホーム画面のスタイル
- `Triadichrome-extension/src/extension/main.tsx`：Reactの起動
- `Triadichrome-extension/src/extension/background.ts`：拡張機能アイコンから入口を開く処理
- `Triadichrome-extension/manifest.template.json`：Manifestの正本
- `scripts/build.mjs`：ビルドと生成物の同期
- `dist/`：ビルド用の一時領域。コミット対象外

開発・検証・コミットのルールは[AGENTS.md](AGENTS.md)を参照してください。
