# 全機能確認用の計画

[全機能確認用.triadic](全機能確認用.triadic)は基準年度2026・保存形式13の確認用データです。生成元は[tests/ui/sample-plan.ts](../tests/ui/sample-plan.ts)、再生成・一致確認は[README](../README.md#確認用のtriadicファイル)を参照してください。実ファイルの上書きを避けるため、試す際はコピーを使用します。

| 実装済み機能・条件 | 根拠となる実装 | 該当データ・操作 | 期待結果 | 確認方法 | 確認範囲 |
|---|---|---|---|---|---|
| 年度 | [core/initiatives.ts](../Triadichrome-extension/src/core/initiatives.ts) | 2026年度の13施策と前年実額を開く | 全明細の年度は2026、1〜3月の年月は2027 | 通常テスト | DB・計算を確認。画面は操作手順として準備 |
| 施策の共通情報 | [core/initiatives.ts](../Triadichrome-extension/src/core/initiatives.ts) | 各施策の展開・業種・部署・任意の期間・備考 | タブを切り替えても共通情報は同じ | 通常テスト | DB・計算を確認。画面は操作手順として準備 |
| 種別 | [core/kindMasterSchema.ts](../Triadichrome-extension/src/core/kindMasterSchema.ts) | 固定の一次・確定・修正・見通し・実績 | 前年の施策タブはなく、種別マスタは閲覧のみ | 通常テスト・DB固定制約 | 固定5件・編集拒否を確認 |
| 自動引き継ぎ | [core/kindAmounts.ts](../Triadichrome-extension/src/core/kindAmounts.ts) | 「修正予算の入力準備」の一次4月100を120へ変更 | 手修正のない確定・見通し・実績は120に追従 | 通常テスト・sample-plan画面テスト | 計算確認、引き継ぎ・解除・開始取消の画面操作を確認 |
| 手修正と解除 | [core/kindAmounts.ts](../Triadichrome-extension/src/core/kindAmounts.ts) | 「確定予算の手修正」の確定4月120・5月0 | 一次変更でも手修正は残り、「引き継ぎに戻す」で追従に戻る | 通常テスト・sample-plan画面テスト | 計算確認、引き継ぎ・解除・開始取消の画面操作を確認 |
| 修正の開始・取消 | [core/kindAmounts.ts](../Triadichrome-extension/src/core/kindAmounts.ts) | 「修正予算の入力準備」の修正10月150 | 未開始は見通し100、開始後150、取消後100。準備150は保持 | 通常テスト・sample-plan画面テスト | 計算確認、引き継ぎ・解除・開始取消の画面操作を確認 |
| 修正の前半 | [core/kindAmounts.ts](../Triadichrome-extension/src/core/kindAmounts.ts) | 同施策の実績4月を90へ変更 | 修正4月は90、4〜9月は直接編集できない | 通常テスト・sample-plan画面テスト | 計算確認、引き継ぎ・解除・開始取消の画面操作を確認 |
| 共通科目行 | [core/kindAmounts.ts](../Triadichrome-extension/src/core/kindAmounts.ts) | 「科目変更と削除の確認」の0行を変更・削除、別タブで追加 | 全タブに反映。どこかに1円でもある行は変更・削除不可 | 通常テスト・sample-plan画面テスト | 計算確認、引き継ぎ・解除・開始取消の画面操作を確認 |
| 前年入力 | [extension/PreviousInputPage.tsx](../Triadichrome-extension/src/extension/PreviousInputPage.tsx) | 業種9件×部署2件に売上・原価・費用・利益の12か月 | 未選択で売上高4月25,290、直営自動車の全部署2,010、全業種の部署A12,600を表示。合計は参照専用、個別の組合せで編集・上書き更新 | 通常テスト・sample-plan画面テスト | 保存・再読込・画面入力を確認 |
| 総原価表 | [core/planTables.ts](../Triadichrome-extension/src/core/planTables.ts) | 前年と確定・見通しを表示、実績を追加選択 | 前年＋各種別の前年差。先に選んだ確定が外れる | 通常テスト・sample-plan画面テスト | 計算を確認。展開表の選択上限と復元を画面確認 |
| 施策一覧 | [extension/HomePage.tsx](../Triadichrome-extension/src/extension/HomePage.tsx) | 実績を選び、ファイルを閉じて開き直す | 実績だけの施策増減を表示し、選択を復元 | 通常テスト・sample-plan画面テスト | 選択・分類条件・再読込時の復元範囲を確認 |
| 展開表 | [core/planTables.ts](../Triadichrome-extension/src/core/planTables.ts) | 見通し・実績の2種を選ぶ | 2種と「実績−見通し」を表示。再読込でも選択順を復元 | 通常テスト・sample-plan画面テスト | 計算を確認。展開表の選択上限と復元を画面確認 |
| 業種・部署 | [extension/HomePage.tsx](../Triadichrome-extension/src/extension/HomePage.tsx) | 各表で分類を複数選択し、画面を往復 | 同分類内はいずれか一致、分類間は両方一致。画面内の選択は維持、再読込はすべて | 通常テスト・sample-plan画面テスト | 選択・分類条件・再読込時の復元範囲を確認 |
| 前年の範囲入力 | [extension/PreviousAmountGrid.tsx](../Triadichrome-extension/src/extension/PreviousAmountGrid.tsx) | 直営自動車・部署Aの売上高とグループ売上高、4〜5月を範囲選択。グループ売上高は4月125.125、5月−20.001、6月0、3月0.001 | コピー・貼り付け・同値入力・消去で科目セルだけを更新し、小計を再計算。不正な貼り付けは全体を拒否 | 通常テスト・previous-grid画面テスト・Codex内のブラウザ | 円精度、範囲操作、部分更新の拒否、保存後の再表示を確認 |
| 明細 | [core/details.ts](../Triadichrome-extension/src/core/details.ts) | 前年と全種別を表示し、月別金額を編集 | 前年は種別・施策とも「前年」。売上・費用・利益の順に表示。通信運搬費4月は0・−2,501・2,501、前年給料手当は0・200・−200。計算列は編集不可。引き継ぐ値も再集計 | 通常テスト・details画面テスト | 分類・金額・更新番号・変更範囲を通常テストで確認 |
| 正負・精度 | [core/initiatives.ts](../Triadichrome-extension/src/core/initiatives.ts) | 売上・原価・費用・利益、負数・1円・同一科目の複数行 | 千円単位小数3桁を保持。科目属性に応じ売上・利益に加減算 | 通常テスト | DB・計算を確認。画面は操作手順として準備 |
| 科目・集計 | [core/aggregationMaster.ts](../Triadichrome-extension/src/core/aggregationMaster.ts) | 59科目・16集計、未所属費用・空の任意集計・削除確認用科目 | 必須集計と任意集計、所属順、空行、未使用科目の削除を確認 | 通常テスト | 集計・所属・制約を確認 |
| マスタ | [core/accountMaster.ts](../Triadichrome-extension/src/core/accountMaster.ts) | 展開7、業種9、部署2、期間2 | 名称変更を参照に反映。施策・前年で使用する項目の削除を拒否 | 各マスタの通常テスト | 変更・使用中削除・保存失敗・キャンセル・競合を確認 |
| 画面操作 | [extension/HomeRelationsPage.tsx](../Triadichrome-extension/src/extension/HomeRelationsPage.tsx) | 相関図、サイドバー、並べ替え、列フィルター、横スクロール | 画面移動と表の操作を確認。保存済みの並びを表示操作で変更しない | Codex内のブラウザ・任意の画面テスト | 今回の種別操作は確認。全操作の実環境保存は対象外 |

キャンセル・保存失敗・外部変更・未知の保存形式は、この正常なファイルへ埋め込めません。[画面テストの入口](../tests/ui/preview.html)と自動テストの模擬ファイルで再現します。自動テストでDB・計算・保存保護を確認し、画面ではタブ、手修正解除、前年入力、選択の復元を確認します。
