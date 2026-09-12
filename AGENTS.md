# グローバル・エージェント運用ルール

## 管理と実作業の分離

- 主エージェントはマネジメントに専念し、タスク分解、担当割り当て、進捗管理、結果の統合、品質確認、およびユーザーとの対話だけを行います。
- 調査、設計、実装、ファイル編集、コマンド実行、テスト、レビューなどの実作業は、必ずモデル `gpt-5.6-luna`、推論強度 `max` のサブエージェントに行わせます。
- 主エージェントは実作業を直接代行しません。複数の独立した作業がある場合は、可能な範囲でサブエージェントへ分担させます。
- 上位の指示、利用可能な機能、または実行環境の制約により指定したサブエージェントを利用できない場合、主エージェントは実作業を引き受けず、制約と未完了内容をユーザーへ説明します。

## 同時実行タスク間の協調

- 他のCodexタスクまたはチャットが同時に動作している場合は、互いの作業状況と対象範囲を確認し、共有ファイル、Git状態、生成物、外部操作が競合しないよう協調します。
- 他タスクの変更を上書き、巻き戻し、stage、commitしません。競合の可能性がある場合は安全な範囲へ分離するか調整し、解消できない場合はユーザーへ報告します。

--- project-doc ---

# Triadichrome 開発エージェント指示

この文書は、Triadichromeで作業するときのリポジトリ固有ルールです。共通のユーザー指示、上位のエージェント指示、現在の依頼範囲を優先します。判断が分かれる場合は推測で広げず、依存する部分を止めて利用者へ確認します。

## 情報源と作業範囲

- 作業開始時に`git status --short`、HEAD、通常差分、cached差分、対象ファイルを確認し、他者の変更を保護します。
- 現行仕様の根拠は、現在の実装、`package.json`、`Triadichrome-extension/manifest.template.json`、`vite.config.ts`、`tsconfig.json`、READMEと検証結果です。過去の計画やコミットだけから現在の仕様を推測しません。
- 質問、調査、説明、レビュー、診断だけの依頼では編集・stage・commit・外部変更を行いません。変更が明示された場合は、指定範囲のローカル編集、正本文書の更新、非破壊的な検証、通常のcommitまで進めます。
- 無関係な差分を編集、削除、stage、commit、巻き戻ししません。Git履歴の書き換え、push、公開、Issue・PR・tag・releaseなどの外部状態変更は、明示された場合だけ行います。利用者が「commitしない」「計画だけ」などと限定した場合は、その限定を優先します。

### 作業を止めて確認する条件

次の判断が既存の依頼、実装、正本文書から確定できない場合は、その判断に依存する部分だけ止め、独立して確認できる範囲を進めてから利用者へ確認します。

- 期待する利用者向けの結果や互換条件を特定できない。
- 複数案で権限、保存データ、公開API、セキュリティ、運用負担が大きく変わる。
- 明示された範囲を実質的に越える必要がある。
- 現行実装、AGENTS.md、Skill、READMEの正本が互いに矛盾する。
- データ消失、履歴書き換え、秘密情報、権限変更、外部送信、公開、費用発生、容易に戻せない操作が必要になる。

## 構成と境界

- パッケージ管理と実行手順は`npm`を使用します。`pnpm`や`yarn`へ置き換えません。
- `Triadichrome-extension/src/`は編集用のTypeScript/React正本です。将来、Chrome APIに依存しない純粋な処理を分離する場合は`Triadichrome-extension/src/core/`へ置き、`chrome.*`や直接の拡張環境依存処理は`Triadichrome-extension/src/extension/`へ置きます。
- `Triadichrome-extension/src/extension/`はManifest V3のservice worker、独立拡張ページ、Chrome adapterなどの環境依存入口を所有します。Dexie、PapaParse、File System Access APIは責務とI/O境界を明示して配置します。
- `Triadichrome-extension/manifest.template.json`は編集するManifestの正本、`Triadichrome-extension/`直下の`manifest.json`・独立ページ・assetsはbuild補助が同期するChrome読み込み・配布物です。生成物はTypeScript正本と区別し、`dist/`はbuild時だけ使う一時領域としてcommitしません。
- 依頼が画面不要と指定している間は、Reactの起動確認用入口を除き、UI、デザイン、業務機能、サンプルデータを追加しません。
- 既存のAGPLv3 LICENSEを変更せず、他プロジェクトのライセンス、著作権表示、公開先、秘密情報、権限、host permissionをコピーしません。

## Skills

プロジェクトSkillは`.agents/skills/*/SKILL.md`に置き、依頼に実際に該当する場合だけ全文を読みます。参照文書はSkillからリンクされた必要なものだけを読み、無関係なSkillや参照元固有の設計を持ち込みません。

- [extension-release](.agents/skills/extension-release/SKILL.md): commit、SemVer、tag、releaseの判断と検証
- [modernize-chrome-extension](.agents/skills/modernize-chrome-extension/SKILL.md): 複数境界にまたがる大規模な拡張機能の現代化
- [extension-issue-workflow](.agents/skills/extension-issue-workflow/SKILL.md): GitHub Issueの調査・対応・外部完了処理の境界

## 検証と完了条件

- 変更直後は対象に必要な検証を行い、commit前は`npm run typecheck`と`npm run build`を基本に、変更範囲に応じた検証を一度実行します。同じHEAD・同じ条件で成功した検証は、関連変更・失敗修正・Node/npm・依存・OSなどの環境変化がない限り再利用します。
- `npm run build`後に`Triadichrome-extension/manifest.json`、service worker、独立ページ、生成された参照先を確認します。Chromeの未パッケージ拡張読み込み、実サイト操作、スクリーンショット、性能確認は明示依頼がある場合だけ行います。
- `git diff --check`、生成物、Git状態を確認し、検証失敗時はcommitしません。ツールの成功表示だけで完了とせず、失敗経路と未確認範囲を報告します。

## version、commit、release

- versionの正はrootの`package.json`です。編集用Manifestの`Triadichrome-extension/manifest.template.json`は同じversionを持たせ、`Triadichrome-extension/manifest.json`は生成物として一致を検証します。
- commitする更新では`package.json`と`Triadichrome-extension/manifest.template.json`のversionを同じcommitへ含めます。
- versionの区分はcommit typeではなく、公開済み機能との互換性と利用者に見える変更でSemVerを決めます。
  - MAJOR: 公開機能、保存データ、設定形式などに後方互換性のない変更
  - MINOR: 後方互換性を保った機能追加、または廃止予定の告知
  - PATCH: 後方互換性を保った不具合修正、公開機能を変えない文書・test・build・保守変更
- 独立した目的はcommitを分け、commitごとにversionを順次更新します。versionだけのcommitは作りません。commit typeとSemVer区分は独立して選びます。
- commit件名は`<type>[!]: <version> <日本語の説明>`とします。typeは`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`から選びます。件名・本文は日本語とし、本文には少なくとも`目的:`と`内容:`（実施内容）を記載し、必要に応じて`scope:`、`確認:`、`影響:`を加えます。
- commit前に`git status`、通常・cached diff、`git diff --cached --check`、version一致、変更に応じた検証を確認します。stageは対象pathを明示し、`git add .`と`git add -A`を使いません。commit後はcommit IDと残存差分を確認します。
- 通常のcommitではGit tagを作りません。tagまたはreleaseは利用者が明示した場合だけ行い、対象worktreeがclean、packageとManifestのversionが一致、必要な検証が成功、versionと一致する未使用の`vX.Y.Z`であることを確認します。tagは注釈付きで作成し、作成後に参照先とGit状態を確認します。既存tagを移動、上書き、削除しません。
