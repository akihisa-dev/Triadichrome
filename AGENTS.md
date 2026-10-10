# Triadichrome 開発エージェント指示

## 正本と製品方針

- 製品の目的と設計判断は[REQUIREMENTS.md](REQUIREMENTS.md)、実装済みの機能・制限と開発コマンドは[README](README.md)を正本とします。実装範囲は現在のコード、設定、検証結果から確認し、目標要件を実装済みとして扱いません。
- 製品の設計・実装・レビューでは、先にREQUIREMENTS.mdを読みます。施策を起点とする作業と合意済みの操作を、一般的なUIの定石より優先します。
- 明示指示がない限り、過去の実装・保存形式・API・操作との互換性は考慮しません。互換性だけを理由に、旧形式対応、移行処理、代替処理、旧仕様の維持を独自判断で追加・温存しません。互換性の維持は明示された対象範囲だけに適用します。ただし、互換性を壊すこと自体を目的にせず、依頼の目的や設計上の必要性がない破壊的変更は行いません。結果として互換性が保たれる実装を、互換性が保たれるという理由で変更することもありません。
- 製品方針の変更はREQUIREMENTS.mdへ、実装済みの範囲と制限はREADMEへ反映します。現行実装の不足に合わせて製品方針を弱めません。
- この文書にはリポジトリ固有の制約と必須検証を置き、個別作業の手順は`.agents/skills/*/SKILL.md`へ置きます。作業履歴は文書へ蓄積せず、コミット本文に残します。

## 開発構成

- 作業はmainで行い、新しいブランチを作成しません。別作業との重複回避を理由にブランチへ分離することも禁止します。
- パッケージ管理と実行手順はnpmを使用します。依存パッケージは完全な版で指定し、`package.json`と`package-lock.json`を揃えます。依存の更新を意図しない環境再現には`npm ci`を使います。追加・更新時には導入理由とライセンスを確認します。
- `Triadichrome-extension/src/`は編集用のTypeScript/React正本です。Chrome APIに依存しないデータ処理は`Triadichrome-extension/src/core/`、`chrome.*`や拡張環境に依存する入口・adapterは`Triadichrome-extension/src/extension/`へ置きます。
- Manifest V3を使います。`Triadichrome-extension/src/extension/`はservice worker、独立拡張ページ、Chrome adapterを所有します。保存形式の処理と、File System Access APIによる実ファイルの読み書きを分離します。
- `Triadichrome-extension/manifest.template.json`はManifestの編集用正本です。同ディレクトリ直下の`manifest.json`・独立ページ・assetsなどはbuildが同期する配布物であり、直接編集しません。ソース変更で配布物が変わる場合は正式なbuildで更新し、同じコミットに含めます。
- Chrome読み込み用の生成先は`dist/extension/`、配布ZIPは`dist/Triadichrome-<version>.zip`です。ZIPには配布物だけを含め、ソース・確認用データ・一時ファイルを含めません。`dist/extension/`はGit管理し、成果物が変わる変更と同じコミットに含めます。配布ZIPはローカルで生成・保持し、Git管理・commit・pushから除外します。`dist/`内の一時作業ファイルも除外します。
- 画面不要と指定された作業では、Reactの起動確認用入口を除き、UI・デザイン・業務機能・サンプルデータを追加しません。
- 既存のAGPLv3 LICENSEを維持します。

## 安全性・依存関係・利用者データ

- `permissions`、`optional_permissions`、`host_permissions`は必要な機能と対象が決まってから追加します。対象、取得・変更する情報、利用者への影響を明確にします。
- リモートコードや拡張機能ページへの外部スクリプトを導入しません。文字列はReactの通常表示や安全なDOM APIで扱い、HTMLとして実行しません。
- 利用者データを扱う変更では、保存場所・保持期間・削除・移行・外部送信・失敗時の挙動を明確にし、キャンセルや処理失敗でデータを失わないことを確認します。
- セキュリティ・権限・データ処理・ビルドの変更は、関連する正本文書へ利用者への影響と確認範囲を反映します。

## 確認用データと対応図

- 機能やデータ項目を追加・変更したときは、[確認用データの生成元](tests/ui/sample-plan.ts)を更新して同じコミットに含め、`samples/全機能確認用.triadic`をローカルで再生成・検証します。内容に影響がない変更では不要なデータ差分を作りません。
- 生成した確認用サンプルはGitHubへ掲載しません。すべての`.triadic`ファイルを`.gitignore`で除外し、コミット前と標準検証で管理対象への混入を拒否します。利用者へ渡すテストデータは`.triadic`ファイルにします。再生成と一致確認は[READMEの手順](README.md#確認用のtriadicファイル)に従います。
- 画面・保存項目・計算規則を変更したときは、「画面とデータ」の対応情報と「計算の仕組み」「処理の流れ」の説明も確認・更新します。構造は保存形式の正本から生成し、生成ファイルを直接編集しません。
- 関連実装の変更を検出した場合は、対応項目と説明を実装に照合してから確認済みの記録を更新します。検証を通すためだけに記録を更新せず、[READMEの対応図の更新手順](README.md#画面とデータの対応情報の更新)に従います。

## 検証と完了条件

- 振る舞いを変える場合は、仕様を確認できる自動テストを追加します。コミット・push前の標準検証は`npm run verify`です。検証コマンドとGitフックの設定は[README](README.md#検証とgitフック)に従います。
- 画面に影響する変更は、Codex内のブラウザで該当する表示・操作を確認します。ブラウザを起動できなければ画面検証は未完了です。
- Playwrightによる`npm run verify:full`は、必要時に明示して実行する任意の追加検証です。専用ブラウザの導入を通常作業の前提にせず、画面自動テストをpushの必須条件にしません。
- 実サイト操作、実ファイルへの保存、ストア用スクリーンショット、性能確認は明示依頼がある場合だけ行います。
- build後はManifest、service worker、独立ページ、生成された参照先を確認します。GitHub Actionsでpush後に同じ検証を重複実行する運用は採用しません。

## version、commit、release

- versionの正はrootの`package.json`です。更新時は`package-lock.json`のプロジェクト版とroot packageの版、Manifest template、buildで生成するManifestを同じ番号に揃え、同じコミットに含めます。
- コミット前に`npm run version:check-staged`でステージ済みの番号の一致を確認します。tag・release前の必須検証は`npm run verify:release`です。同コマンドのタグ確認はローカル対象のため、公開する場合は反映先の同名タグも確認します。

## プロジェクトSkills

- [refactor-triadichrome](.agents/skills/refactor-triadichrome/SKILL.md): 機能・操作・保存データを維持する全面リファクタリング
- [generate-triadic-sample](.agents/skills/generate-triadic-sample/SKILL.md): 全機能を試せる.triadicサンプルの生成と検証
