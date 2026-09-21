# Triadichrome

Chrome Extension (Manifest V3) の開発基盤です。
予算データは、専用の `.triadic` ファイルへ保存します。

## 技術スタック

- TypeScript
- React / React DOM
- Vite
- sql.js（ブラウザでSQLiteを扱うためのWebAssembly実装）
- Dexie.js
- PapaParse
- Chrome Extension Manifest V3
- File System Access API（TypeScript の DOM 標準型）

## 必要環境

- Node.js 20.19 以上
- npm

## セットアップ

```sh
npm install
```

## 開発・検証・ビルド

```sh
# Vite の開発サーバーを起動
npm run dev

# TypeScript の型チェック
npm run typecheck

# Triadichrome-extension/ に Chrome 拡張を生成
npm run build
```

`npm run build` は型チェック後に `scripts/build.mjs` が一時領域で Vite の本番ビルドを実行し、生成した Manifest、独立ページ、assetsをリポジトリ直下の `Triadichrome-extension/` に同期します。`Triadichrome-extension/manifest.template.json` とTypeScript正本はそのまま保持されます。ファイルを開くか新規作成するとホーム画面へ移動し、三角形のメニューから明細、総原価表、展開表、施策入力の各画面へ移動できます。各画面は現段階では枠のみを表示します。

## `.triadic` ファイル

利用者が開く予算データは、拡張子 `.triadic` の専用ファイルです。
ファイルの中身は標準的なSQLiteデータベースであり、JSON、CSV、Excelを保存形式として使用しません。

一つのファイルに、一つの予算と、その予算に対応する実績を保存します。
SQLiteのデータベース内には、次の情報を持ちます。

- `triadic_metadata`：形式識別子、形式のバージョン、SQLiteコンテナであること
- `budgets`：予算名、対象期間、作成日時、更新日時
- `periods`：年月
- `initiatives`：入力単位である施策
- `accounts`：勘定科目
- `details`：施策と勘定科目と年月の組み合わせごとの予算、実績、売上、利益、メモ

総原価表と展開表は、`details` の内容をそれぞれ勘定科目と施策の軸で集計するSQLiteビューです。
三表は同じ予算データを異なる軸で表す三面等価の関係にあり、集計結果を別の正本として重複保存しません。

## Chrome で読み込む

1. `npm run build` を実行します。
2. Chrome で `chrome://extensions` を開き、デベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」を選択します。
4. このリポジトリ直下の `Triadichrome-extension/`（build後に生成された `manifest.json` が直下にあるフォルダー）だけを指定します。build前の同フォルダーにはManifestがないため、先にbuildしてください。
5. 拡張機能のアイコンをクリックすると、Manifest V3 の service worker が拡張機能ページ（`index.html`）を新しいタブで開きます。

`dist/` はbuild時の一時領域として使うため Git 管理しません。ソースを変更した場合は、再度 `npm run build` を実行してから拡張機能管理画面の更新ボタンを押してください。

## 開発ルール

作業範囲、Manifest V3とソース／生成物の境界、検証条件、コミット・SemVer・tagの扱いは [AGENTS.md](AGENTS.md) を正本とします。依頼に該当する補助的なSkillは `.agents/skills/` に置いています。

- [extension-release](.agents/skills/extension-release/SKILL.md): commitタイミング、SemVer、tag、releaseの判断と検証
- [modernize-chrome-extension](.agents/skills/modernize-chrome-extension/SKILL.md): 複数境界にまたがる拡張機能の現代化
- [extension-issue-workflow](.agents/skills/extension-issue-workflow/SKILL.md): GitHub Issueの調査・対応・外部完了処理の境界

## ディレクトリ

```text
index.html                              # Viteが処理するページ入口
Triadichrome-extension/
  manifest.template.json                # 編集用 Manifest の正本
  manifest.json                         # buildで生成されるManifest
  index.html                            # buildで生成される独立ページ
  assets/                               # buildで生成されるJS/CSS
  src/
    core/                               # Chrome APIに依存しないデータ処理の正本
      triadicSchema.ts                  # .triadicのSQLite形式定義
      triadicDatabase.ts                # .triadicの作成・検証処理
    extension/                          # ReactページとMV3 service workerの正本
      ExtensionPage.tsx                 # 入口画面とホーム・各画面の正本
      background.ts                     # service workerの正本
      background.js                     # buildで生成されるservice worker
scripts/
  paths.mjs                             # 正本・生成物のパス定義
  build.mjs                             # ViteビルドとManifest生成
dist/                                  # build時だけ使う一時領域
vite.config.ts                          # ページと service worker の複数エントリ設定
```

Dexie.js、PapaParse、React は依存関係として導入済みです。CSVの出力業務ロジック、IndexedDBのテーブル定義、明細や各表の編集画面は今後の機能実装で追加します。
