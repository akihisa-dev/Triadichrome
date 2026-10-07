# Triadichrome 開発エージェント指示

この文書は、Triadichromeで作業するときのリポジトリ固有ルールです。共通のユーザー指示、上位のエージェント指示、現在の依頼範囲を優先します。判断が分かれる場合は推測で広げず、依存する部分を止めて利用者へ確認します。サブエージェントへの委譲と同時編集は、グローバル`AGENTS.md`の基準に従います。

## 情報源と作業範囲

- 作業開始時に`git status --short`、HEAD、通常差分、cached差分、対象ファイルを確認し、他者の変更を保護します。
- 製品の目的と設計判断の正本は[製品方針と要件](REQUIREMENTS.md)です。実装済みの範囲の根拠は、現在の実装、`package.json`、`Triadichrome-extension/manifest.template.json`、`vite.config.ts`、`tsconfig.json`、READMEと検証結果です。目標要件を実装済みと扱わず、過去の計画やコミットだけから現在の仕様を推測しません。
- 質問、調査、説明、レビュー、診断だけの依頼では編集・stage・commit・外部変更を行いません。変更が明示された場合は、指定範囲のローカル編集、正本文書の更新、非破壊的な検証、通常のcommitまで進めます。
- 感想、好み、案への賛同、希望する方向性と、変更を実行する依頼を区別します。「これいいね」「こうしたいよね」「一色あった方がいいと思わない？」などの発言だけを実装指示や変更の承認と扱わず、相談として応答します。「実装して」「変更して」「追記して」など、文脈上も実行を求める依頼がある場合に変更へ進みます。既に実行を依頼された作業中の追加発言は、その依頼の範囲に照らして反映し、同じ承認を求め直しません。実行依頼か判断できず、変更の開始がその判断に依存する場合は、編集前に意図を確認します。
- 製品機能、画面、対象サイト、保存情報、外部送信、権限、公開先、配布方法は、明示された依頼の範囲で扱い、推測で追加しません。
- 無関係な差分を編集、削除、stage、commit、巻き戻ししません。Git履歴の書き換え、remote設定、push、公開、PR・tag・release、リポジトリ作成・ブランチ保護などのGitHub設定変更は、明示された場合だけ行います。Issue対応の依頼には対象Issueへの対応コメントとクローズを含みます。Issueの新規作成・再開・ラベル・担当者の変更は、別途明示依頼がある場合だけ行います。利用者が「commitしない」「調査だけ」「コメントしない」「クローズしない」などと限定した場合は、その限定を優先します。
- 共通の開発・commit・version・Issue運用は[Harvest](https://github.com/akihisa-dev/Harvest/blob/main/AGENTS.md)を参照し、この文書でTriadichromeへの適用内容を定めます。npm、生成物の配置、製品固有の検証内容はTriadichromeの構成を維持し、参照元の機能・製品仕様・画像・コード・履歴を複製しません。
- 作業はmainで行い、新しいブランチを作成しません。別作業との重複回避を理由にブランチへ分離することも禁止します。

### 製品方針の適用

- 製品の設計・実装・レビューでは、先に[製品方針と要件](REQUIREMENTS.md)を読み、今回の変更を関連する判断基準と照合します。一般的なUIの定石より、施策を起点とする作業と、この製品で合意した操作を優先します。
- 意図が不明な場合は、現在の依頼、要件、実装、必要な過去の発言を確認してから、結果を左右する不明点だけを質問します。回答済みの内容を聞き直さず、一度に判断を求める事項を絞ります。選択肢は重なりや欠落を避け、操作と結果の違いを示します。根拠を持って判断し、同調や説明だけで修正を終えません。
- 指定された画面の範囲と配置を守り、未指定の業務機能や計算規則を補いません。通常の実装判断は既存の依頼から補い、重要な判断だけを確認して、承認された範囲の検証とコミットまで進めます。
- 方針を変更する場合は、要件の該当箇所を更新し、実装済みの範囲と制限をREADMEへ反映します。利用者が意図した変更と実装の不足を区別し、現行実装に合わせるためだけに製品方針を弱めません。

### 作業を止めて確認する条件

次の判断が既存の依頼、実装、正本文書から確定できない場合は、その判断に依存する部分だけ止め、独立して確認できる範囲を進めてから利用者へ確認します。

- 期待する利用者向けの結果や互換条件を特定できない。
- 複数案で権限、保存データ、公開API、セキュリティ、運用負担が大きく変わる。
- 明示された範囲を実質的に越える必要がある。
- 現行実装、AGENTS.md、Skill、READMEの正本が互いに矛盾する。
- データ消失、履歴書き換え、秘密情報、権限変更、外部送信、公開、費用発生、容易に戻せない操作が必要になる。

## 構成と境界

- パッケージ管理と実行手順は`npm`を使用します。`pnpm`や`yarn`へ置き換えません。
- `Triadichrome-extension/src/`は編集用のTypeScript/React正本です。Chrome APIに依存しないデータ処理は`Triadichrome-extension/src/core/`へ置き、`chrome.*`や直接の拡張環境依存処理は`Triadichrome-extension/src/extension/`へ置きます。
- Manifest V3を使います。`Triadichrome-extension/src/extension/`はservice worker、独立拡張ページ、Chrome adapterなどの環境依存入口を所有します。保存形式の処理と、File System Access APIによる実ファイルの読み書きを分離します。
- `Triadichrome-extension/manifest.template.json`は編集するManifestの正本、`Triadichrome-extension/`直下の`manifest.json`・独立ページ・assetsはbuild補助が同期するChrome読み込み・配布物です。生成物を直接編集せず、TypeScript正本と区別します。`dist/`はbuild時だけ使う一時領域としてcommitしません。
- 依頼が画面不要と指定している間は、Reactの起動確認用入口を除き、UI、デザイン、業務機能、サンプルデータを追加しません。
- 既存のAGPLv3 LICENSEを変更せず、他プロジェクトのライセンス、著作権表示、公開先、秘密情報、権限、host permissionをコピーしません。

## 安全性・依存関係・利用者データ

- 必要な機能と対象が決まるまで`permissions`、`optional_permissions`、`host_permissions`を追加しません。追加時は対象、取得・変更する情報、利用者への影響を説明し、既存の依頼で承認されていない範囲を確認します。
- 理由のない通信、解析、広告、リモートコード、依存パッケージ、保存情報を追加しません。文字列をHTMLとして実行せず、Reactの通常の文字列表示や安全なDOM APIを使います。拡張機能ページに外部スクリプトを読み込みません。
- 依存パッケージの追加・更新では必要性、導入理由、ライセンスを確認し、`package.json`に範囲指定ではなく完全な版を指定して`package-lock.json`と揃えます。依存の更新を意図しない環境再現には`npm ci`を使います。
- 利用者データを扱う変更では、保存場所、保持期間、削除、移行、外部送信、失敗時の挙動を明確にします。既存データを利用者に知らせず削除・上書きせず、キャンセルや処理失敗でデータを失わないことを確認します。
- セキュリティ、権限、データ処理、ビルド、GitHub運用を変える場合は、関連する正本文書も更新します。保存・移行・権限などの利用者への影響と、確認できた範囲を記載します。

## 文書とSkills

製品の目的と設計判断は[REQUIREMENTS.md](REQUIREMENTS.md)、開発の判断基準はこの`AGENTS.md`、実装済みの機能と開発者向けのコマンド・環境準備は[README](README.md)、個別作業の手順はSkillに置きます。同じ規則を各文書へ複製せず、正本へのリンクを使います。文書には現在の方針と仕様を保ち、作業履歴はコミット本文に残します。

プロジェクトSkillは`.agents/skills/*/SKILL.md`に置き、依頼に実際に該当する場合だけ全文を読みます。参照文書はSkillからリンクされた必要なものだけを読み、無関係なSkillや参照元固有の設計を持ち込みません。

- [extension-release](.agents/skills/extension-release/SKILL.md): commit、SemVer、tag、releaseの判断と検証
- [refactor-triadichrome](.agents/skills/refactor-triadichrome/SKILL.md): リポジトリ全体の調査と、機能・操作・保存データを維持する全面リファクタリングの設計・実行
- [extension-issue-workflow](.agents/skills/extension-issue-workflow/SKILL.md): GitHub Issueの妥当性判断、修正・検証、対応コメント・クローズ
- [generate-triadic-sample](.agents/skills/generate-triadic-sample/SKILL.md): 作成時点の全機能を試せる.triadicサンプルの設計、生成、網羅性の検証

## 検証と完了条件

- 機能やデータ項目を追加・変更したときは、実装済みの機能を試せるよう[確認用データの生成元](tests/ui/sample-plan.ts)も更新し、生成した[samples/全機能確認用.triadic](samples/全機能確認用.triadic)を同じcommitに含めます。内容に影響がない変更では不要なデータ差分を作りません。再生成と一致確認の手順は[README](README.md#確認用のtriadicファイル)に従い、利用者へ渡すテストデータは`.triadic`ファイルにします。
- 画面・保存項目・計算規則を変更したときは、「画面とデータ」の対応情報も同じ変更で確認・更新します。構造は保存形式の正本から生成し、生成ファイルを直接編集しません。関連実装の変更を検出した場合は、対応項目と説明を照合してから確認済みの記録を更新します。検証を通すためだけに確認記録を更新せず、[READMEの対応図の更新手順](README.md#画面とデータの対応情報の更新)に従います。
- 振る舞いを変える場合は仕様を確認できる自動テストを追加し、影響に応じた検証を行います。commit前の標準検証は`npm run verify`です。画面に影響する変更はCodex内のブラウザで該当する表示・操作を確認します。Playwrightによる画面自動テスト（`npm run verify:full`）は必要時に明示して実行する任意の追加検証で、専用ブラウザの導入を通常作業の前提にしません。同じHEAD・同じ条件で成功した検証は、関連変更・失敗修正・Node/npm・依存・OSなどの環境変化がない限り再利用します。
- 検証内容とGitフックの設定手順は[README](README.md#検証とgitフック)を参照します。build後はManifest、service worker、独立ページ、生成された参照先を確認します。画面検証でブラウザを起動できない場合は検証失敗とし、省略して成功扱いにしません。実サイト操作、実ファイルへの保存、ストア用スクリーンショット、性能確認は明示依頼がある場合だけ行います。
- push前には`npm run verify`を通します。画面確認をCodex内のブラウザで行うため、参照元のHarvestと異なり、画面自動テストをpushの必須条件にしません。Gitフックによるcommit・push前の確認を有効にし、既存の別フック設定を黙って上書きしません。GitHub Actionsでpush後に同じ検証を重複実行する運用は採用しません。
- `git diff --check`、生成物、Git状態を確認し、検証失敗時はcommitしません。ツールの成功表示だけで完了とせず、失敗経路と未確認範囲を報告します。

## version、commit、release

- versionの正はrootの`package.json`です。編集用Manifestの`Triadichrome-extension/manifest.template.json`は同じversionを持たせ、`Triadichrome-extension/manifest.json`は生成物として一致を検証します。
- commitする更新では`package.json`、`Triadichrome-extension/manifest.template.json`、生成済み`Triadichrome-extension/manifest.json`の同じversionを同一commitへ含めます。`package-lock.json`のversionも揃え、ソース変更で生成物が変わる場合はbuildで更新して同じcommitに含めます。
- versionの区分はcommit typeではなく、公開済み機能との互換性と利用者に見える変更でSemVerを決めます。
  - MAJOR: 公開機能、保存データ、設定形式などに後方互換性のない変更
  - MINOR: 後方互換性を保った機能追加、または廃止予定の告知
  - PATCH: 後方互換性を保った不具合修正、公開機能を変えない文書・test・build・保守変更
- 独立した目的はcommitを分け、commitごとにversionを順次更新します。versionだけのcommitは作りません。commit typeとSemVer区分は独立して選びます。
- commit件名は`<type>[!]: <version> <日本語の説明>`とします。typeは`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`から選びます。件名・本文は日本語とし、複数ファイル、version更新、運用変更を含む本文には`scope:`、`目的:`、`内容:`、`確認:`、`影響:`を記載します。`scope:`の対象は英語小文字の名詞で書きます。
- commit前に`git status`、通常・cached diff、`git diff --cached --check`、version一致、変更に応じた検証を確認します。stageは対象pathを明示し、`git add .`と`git add -A`を使いません。commit後はcommit IDと残存差分を確認します。
- 通常のcommitではGit tagを作りません。tagまたはreleaseは利用者が明示した場合だけ行い、`npm run verify:release`を通します。対象worktreeがclean、packageとManifestのversionが一致、必要な検証が成功、versionと一致する未使用の`vX.Y.Z`であることを確認します。tagは注釈付きで作成し、作成後に参照先とGit状態を確認します。既存tagを移動、上書き、削除しません。

## Issue対応

- Issue対応を依頼されたら、本文・関連コメント・完了条件を読み、現在の仕様・実装・再現結果に照らして妥当性を判断します。Issue指定がなければ、そのリポジトリの未対応Issueすべてを原則対象にし、除外する場合は理由を伝えます。
- 妥当なら必要な変更・文書・検証を完了し、Issueごとにcommitを分け、本文で対象Issueを特定します。複数Issueの変更を同じcommitに混在させません。
- 既に解消済み、重複、現行仕様と整合しない要求などで対応不要なら、根拠をコメントしてクローズします。変更不要のIssueに空のcommitを作りません。再現不能や情報不足だけで対応不要とは判断しません。
- 必要な対応・検証・依頼された反映が完了したら、日本語の丁寧な対応コメントを投稿し、理由に合ったクローズを行って状態を再確認します。情報待ち、検証失敗、権限・通信の問題が残る場合は、無理に閉じず未完了の範囲と理由を報告します。push・PR・releaseはIssue対応だけでは許可された扱いにしません。
