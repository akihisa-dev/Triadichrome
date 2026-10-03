# Triadichrome

施策ごとの計画を入力し、明細・総原価表・展開表の三つの視点で確認するChrome拡張機能です。
計画データは、専用の `.triadic` ファイルへ保存します。現在の対象は計画の作成であり、実績の入力・表示は行いません。

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

# 保存とデータ操作のテスト
npm test

# TypeScript の型チェック
npm run typecheck

# Triadichrome-extension/ に Chrome 拡張を生成
npm run build
```

`npm run build` は型チェック後に `scripts/build.mjs` が一時領域で Vite の本番ビルドを実行し、生成した Manifest、独立ページ、assetsをリポジトリ直下の `Triadichrome-extension/` に同期します。`Triadichrome-extension/manifest.template.json` とTypeScript正本はそのまま保持されます。ファイルを開くか新規作成するとホーム画面へ移動し、三角形のメニューから明細、総原価表、展開表、施策入力の各画面へ移動できます。各画面へは上部のボタンからも直接移動できます。明細・総原価表・展開表は、ファイルに登録済みの内容を表示します。

## 入力と保存

施策入力画面で、予算名、施策、勘定科目、年月を登録できます。名前はその場で編集し、Enterまたは入力欄から離れる操作で確定します。Escapeで名前の入力を取り消します。施策と勘定科目は左の取っ手をドラッグして並べ替えます。挿入位置は線で表示され、取っ手にフォーカスして上下の矢印キーを押す方法も使えます。

施策・勘定科目・年月を登録したら、施策入力または明細画面の「明細を追加」から原価・売上・メモを入力し、「計画を保存」で確定します。金額は円単位で小数第2位まで、原価・売上・計算後の利益はいずれも絶対値1兆以下です。利益は売上から原価を引いて計算し、表示は小数第2位までにそろえます。売上がない費用明細では売上を0にします。施策全体の売上を複数の費用明細へ重複して入力しないでください。

明細は施策・勘定科目・年月の組み合わせにつき一件です。「編集」で金額やメモを修正し、施策・科目・年月を変更して移動できます。「複製」は内容を入力欄へコピーするので、組み合わせを変更して保存してください。重複する組み合わせへの保存は拒否します。明細は施策・年月で絞り込めます。削除には確認があり、使用中の施策・科目・年月は削除できません。

総原価表は科目別・月別、展開表は施策別・月別に原価・売上・利益を集計します。各画面の上部に計画全体の合計、明細の下部に絞り込み後の合計を表示します。

確定した変更は元の `.triadic` ファイルへ自動保存します。保存中は次の編集を待機させ、保存失敗時は画面に内容を保持して、再試行または別名保存を案内します。入力中の明細がある場合は画面移動時に取り消しを確認し、未保存または入力中のままタブを閉じようとすると確認が表示されます。「ファイルを閉じる」で入口へ戻り、別の計画を開けます。「別名で保存」は確定済みの内容を保存するため、入力中の明細は先に「計画を保存」で確定してください。ファイルを開く方法によって元ファイルへ書き込めない場合は、先に「別名で保存」で保存先を選択してください。

保存前に元ファイルの内容を比較し、他の場所で変更されていれば上書きしません。同じ拡張機能のタブ同士では保存処理を順番に実行します。外部アプリとの同時編集・統合は対応していません。

実績管理、前年との比較、Excel/CSV出力は現在の対象外です。

## `.triadic` ファイル

利用者が開く予算データは、拡張子 `.triadic` の専用ファイルです。
ファイルの中身は標準的なSQLiteデータベースであり、JSON、CSV、Excelを保存形式として使用しません。

一つのファイルで、一つの計画を管理します。従来のファイルとの互換性のため実績用の列は残していますが、計画編集では変更せず、画面にも表示しません。実績が記録されている既存明細の削除は拒否します。
SQLiteのデータベース内には、次の情報を持ちます。

- `triadic_metadata`：形式識別子、形式のバージョン、SQLiteコンテナであること
- `budgets`：予算名、対象期間、作成日時、更新日時
- `periods`：年月
- `initiatives`：入力単位である施策
- `accounts`：勘定科目
- `details`：施策と勘定科目と年月の組み合わせごとの予算、実績、売上、利益、メモ

総原価表と展開表は、`details` の内容をそれぞれ勘定科目と施策の軸でSQL集計します。ファイル内の従来のビューは互換性のため保持します。画面の利益は既存ファイルでも原価と売上から計算し、保存済みの利益列を正本にしません。
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

Dexie.js、PapaParse、React は依存関係として導入済みです。CSV出力の業務ロジックとIndexedDBのテーブル定義は未実装です。
