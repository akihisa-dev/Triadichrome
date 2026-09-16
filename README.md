# Triadichrome

Chrome Extension (Manifest V3) の開発基盤です。入口画面を備え、業務機能は今後実装します。

## 技術スタック

- TypeScript
- React / React DOM
- Vite
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

Dexie.js、PapaParse、React は依存関係として導入済みです。CSV の業務ロジックや IndexedDB のテーブル定義、File System Access API の入出力処理は今後の機能実装で追加します。
