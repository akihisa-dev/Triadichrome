# Triadichrome

Chrome Extension (Manifest V3) の開発基盤です。画面や業務機能はまだ実装していません。

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

# dist/ に Chrome 拡張をビルド
npm run build
```

`npm run build` は型チェック後に Vite の本番ビルドを実行します。現段階の拡張ページは起動確認用の空ページで、UI や業務処理は含みません。

## Chrome で読み込む

1. `npm run build` を実行します。
2. Chrome で `chrome://extensions` を開き、デベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」を選択し、このリポジトリの `dist/extension/` フォルダーを指定します。
4. 拡張機能のアイコンをクリックすると、Manifest V3 の service worker が拡張機能ページ（`index.html`）を開きます。

`dist/` は生成物のため Git 管理しません。ソースを変更した場合は、再度 `npm run build` を実行してから拡張機能管理画面の更新ボタンを押してください。

## 開発ルール

作業範囲、Manifest V3とソース／生成物の境界、検証条件、コミット・SemVer・tagの扱いは [AGENTS.md](AGENTS.md) を正本とします。依頼に該当する補助的なSkillは `.agents/skills/` に置いています。

- [extension-release](.agents/skills/extension-release/SKILL.md): commitタイミング、SemVer、tag、releaseの判断と検証
- [modernize-chrome-extension](.agents/skills/modernize-chrome-extension/SKILL.md): 複数境界にまたがる拡張機能の現代化
- [extension-issue-workflow](.agents/skills/extension-issue-workflow/SKILL.md): GitHub Issueの調査・対応・外部完了処理の境界

## ディレクトリ

```text
index.html              # 独立した拡張機能ページの入口
src/extension/          # React の最小エントリ（現在は空ページ）
src/extension/background.ts # MV3 service worker
public/manifest.json    # MV3 manifest（Vite が dist/extension/ にコピー）
vite.config.ts          # ページと service worker の複数エントリ設定
```

Dexie.js、PapaParse、React は依存関係として導入済みです。CSV の業務ロジックや IndexedDB のテーブル定義、File System Access API の入出力処理は今後の機能実装で追加します。
