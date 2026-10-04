# Triadichrome 開発エージェント指示

この文書は、Triadichromeで作業するときのリポジトリ固有ルールです。共通のユーザー指示、上位のエージェント指示、現在の依頼範囲を優先します。判断が分かれる場合は推測で広げず、依存する部分を止めて利用者へ確認します。サブエージェントへの委譲と同時編集は、グローバル`AGENTS.md`の基準に従います。

## 情報源と作業範囲

- 作業開始時に`git status --short`、HEAD、通常差分、cached差分、対象ファイルを確認し、他者の変更を保護します。
- 現行仕様の根拠は、現在の実装、`package.json`、`Triadichrome-extension/manifest.template.json`、`vite.config.ts`、`tsconfig.json`、READMEと検証結果です。過去の計画やコミットだけから現在の仕様を推測しません。
- 質問、調査、説明、レビュー、診断だけの依頼では編集・stage・commit・外部変更を行いません。変更が明示された場合は、指定範囲のローカル編集、正本文書の更新、非破壊的な検証、通常のcommitまで進めます。
- 無関係な差分を編集、削除、stage、commit、巻き戻ししません。Git履歴の書き換え、push、公開、PR・tag・releaseなどの外部状態変更は、明示された場合だけ行います。Issue対応の依頼には対象Issueへの対応コメントとクローズを含みます。Issueの新規作成・再開・ラベル・担当者の変更は、別途明示依頼がある場合だけ行います。利用者が「commitしない」「調査だけ」「コメントしない」「クローズしない」などと限定した場合は、その限定を優先します。
- 共通のcommit・version・Issue運用はHarvestを参照します。npm、生成物の配置、製品固有の検証内容はTriadichromeの構成を維持します。
- 作業はmainで行い、新しいブランチを作成しません。別作業との重複回避を理由にブランチへ分離することも禁止します。

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
- [extension-issue-workflow](.agents/skills/extension-issue-workflow/SKILL.md): GitHub Issueの妥当性判断、修正・検証、対応コメント・クローズ

## 検証と完了条件

- 振る舞いを変える場合は仕様を確認できる自動テストを追加し、影響に応じた検証を行います。commit前は`npm run verify:full`を基本とし、画面に影響しない変更では`npm run verify`を選べます。どちらか一つを実行し、同じHEAD・同じ条件で成功した検証は、関連変更・失敗修正・Node/npm・依存・OSなどの環境変化がない限り再利用します。
- `npm run verify`はGitフック設定、型検査を含むbuild、通常テスト、version一致を確認します。buildはManifest、service worker、独立ページ、生成された参照先を検査します。`npm run verify:full`は既存の画面自動テストも実行し、ブラウザを起動できない場合は検証失敗とします。実サイト操作、実ファイルへの保存、ストア用スクリーンショット、性能確認は明示依頼がある場合だけ行います。
- push前には`npm run verify:full`を通します。Gitフックは`npm run setup:hooks`で有効にし、`pre-commit`でstage済み差分と3つのversionの同時登録・一致を確認し、`pre-push`で`npm run verify:full`を実行します。通常の検証もフック未設定なら停止して設定方法を案内します。GitHub Actionsでpush後に同じ検証を重複実行する運用は採用しません。
- `git diff --check`、生成物、Git状態を確認し、検証失敗時はcommitしません。ツールの成功表示だけで完了とせず、失敗経路と未確認範囲を報告します。

## version、commit、release

- versionの正はrootの`package.json`です。編集用Manifestの`Triadichrome-extension/manifest.template.json`は同じversionを持たせ、`Triadichrome-extension/manifest.json`は生成物として一致を検証します。
- commitする更新では`package.json`、`Triadichrome-extension/manifest.template.json`、生成済み`Triadichrome-extension/manifest.json`の同じversionを同一commitへ含めます。`package-lock.json`のversionも揃え、ソース変更で生成物が変わる場合はbuildで更新して同じcommitに含めます。
- versionの区分はcommit typeではなく、公開済み機能との互換性と利用者に見える変更でSemVerを決めます。
  - MAJOR: 公開機能、保存データ、設定形式などに後方互換性のない変更
  - MINOR: 後方互換性を保った機能追加、または廃止予定の告知
  - PATCH: 後方互換性を保った不具合修正、公開機能を変えない文書・test・build・保守変更
- 独立した目的はcommitを分け、commitごとにversionを順次更新します。versionだけのcommitは作りません。commit typeとSemVer区分は独立して選びます。
- `npm run version:next -- patch`などで次のversion候補を表示できます。ファイルは自動変更しません。
- commit件名は`<type>[!]: <version> <日本語の説明>`とします。typeは`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`から選びます。件名・本文は日本語とし、複数ファイル、version更新、運用変更を含む本文には`scope:`、`目的:`、`内容:`、`確認:`、`影響:`を記載します。`scope:`の対象は英語小文字の名詞で書きます。
- commit前に`git status`、通常・cached diff、`git diff --cached --check`、version一致、変更に応じた検証を確認します。stageは対象pathを明示し、`git add .`と`git add -A`を使いません。commit後はcommit IDと残存差分を確認します。
- 通常のcommitではGit tagを作りません。tagまたはreleaseは利用者が明示した場合だけ行い、`npm run verify:release`を通します。対象worktreeがclean、packageとManifestのversionが一致、必要な検証が成功、versionと一致する未使用の`vX.Y.Z`であることを確認します。tagは注釈付きで作成し、作成後に参照先とGit状態を確認します。既存tagを移動、上書き、削除しません。

## Issue対応

- Issue対応を依頼されたら、本文・関連コメント・完了条件を読み、現在の仕様・実装・再現結果に照らして妥当性を判断します。Issue指定がなければ、そのリポジトリの未対応Issueすべてを原則対象にし、除外する場合は理由を伝えます。
- 妥当なら必要な変更・文書・検証を完了し、Issueごとにcommitを分け、本文で対象Issueを特定します。複数Issueの変更を同じcommitに混在させません。
- 既に解消済み、重複、現行仕様と整合しない要求などで対応不要なら、根拠をコメントしてクローズします。変更不要のIssueに空のcommitを作りません。再現不能や情報不足だけで対応不要とは判断しません。
- 必要な対応・検証・依頼された反映が完了したら、日本語の丁寧な対応コメントを投稿し、理由に合ったクローズを行って状態を再確認します。情報待ち、検証失敗、権限・通信の問題が残る場合は、無理に閉じず未完了の範囲と理由を報告します。push・PR・releaseはIssue対応だけでは許可された扱いにしません。
