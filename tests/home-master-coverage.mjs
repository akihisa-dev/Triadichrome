import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function verifyHomeMasterCoverage({ MasterPage, HomeRelationsPage, AccountTypeMasterPage, accountTypes, AmountItemMasterPage, accountEffectsYen }) {
  const menu = renderToStaticMarkup(createElement(MasterPage, {}));
  const graph = renderToStaticMarkup(createElement(HomeRelationsPage, { view: { current: null }, disabled: false, onNavigate() {} }));
  const menuNames = [...menu.matchAll(/<strong>([^<]+)<\/strong>/g)].map(match => match[1]);
  const graphNames = [...graph.matchAll(/<button[^>]*class="home-relation-node is-master[^\"]*"[^>]*>[\s\S]*?<span class="home-relation-name">([^<]+)<\/span><\/button>/g)].map(match => match[1]);
  assert.ok(menuNames.length > 0, "マスタ入口の項目を取得できる");
  assert.equal(new Set(graphNames).size, graphNames.length, "相関図のマスタを重複表示しない");
  assert.deepEqual(graphNames.toSorted(), menuNames.toSorted(), "マスタ入口とホームの全マスタが一致する（追加漏れ・余分な項目を拒否）");
  assert.ok(menuNames.includes("科目属性マスタ"), "科目属性マスタを入口と相関図へ表示する");
  const attributes = renderToStaticMarkup(createElement(AccountTypeMasterPage, { isSaving: false, onBack() {} }));
  const attributeNames = [...attributes.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(match => match[1]);
  assert.deepEqual(attributeNames, ["売上", "売上原価", "費用", "利益"], "科目属性は固定4件を業務順で表示する");
  assert.deepEqual(attributeNames, Object.values(accountTypes), "勘定科目の選択候補と同じ属性を表示する");
  assert.equal([...attributes.matchAll(/<button\b/g)].length, 1, "戻る以外の追加・編集・削除操作を設けない");
  assert.ok(!/<(?:input|select|textarea|form)\b/.test(attributes), "名称を編集できない");
  const saving = renderToStaticMarkup(createElement(AccountTypeMasterPage, { isSaving: true, onBack() {} }));
  assert.match(saving, /<button[^>]*disabled/, "保存中は戻る操作を待機する");
  assert.ok(menuNames.includes("金額項目マスタ"), "金額項目マスタを入口と相関図へ表示する");
  const amounts = renderToStaticMarkup(createElement(AmountItemMasterPage, { isSaving: false, onBack() {} }));
  assert.deepEqual([...amounts.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(match => match[1]), ["売上", "費用", "利益"]);
  assert.deepEqual([...amounts.matchAll(/<tr><td>([123])<\/td><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><\/tr>/g)].map(match => match.slice(1)), [
    ["1", "売上", "売上 − 売上原価"], ["2", "費用", "費用"], ["3", "利益", "売上 − 売上原価 − 費用 ＋ 利益"],
  ], "固定の表示順・名称・科目属性の構成を確認できる");
  assert.equal([...amounts.matchAll(/<button\b/g)].length, 1);
  assert.ok(!/<(?:input|select|textarea|form)\b/.test(amounts), "金額項目と構成は編集できない");
  const inputs = [["sales", 1001], ["cost", 200], ["expense", 300], ["profit", 400]];
  for (const direction of [1, -1]) {
    const totals = inputs.reduce((total, [attribute, yen]) => {
      const value = accountEffectsYen(yen * direction, attribute);
      return { sales: total.sales + value.sales, expense: total.expense + value.expense, profit: total.profit + value.profit };
    }, { sales: 0, expense: 0, profit: 0 });
    assert.deepEqual(totals, { sales: 801 * direction, expense: 300 * direction, profit: 901 * direction }, "表示する構成どおりに正負の金額を計算する");
  }
  for (const attribute of [null, undefined, "unknown", "constructor"])
    assert.deepEqual(accountEffectsYen(1001, attribute), { sales: 0, expense: 0, profit: 0 });
  assert.ok(!graph.includes('data-page="initiative-entry"'), "新規登録の直通入口をホームへ残さない");
  assert.equal([...graph.matchAll(/data-page="initiative-list"/g)].length, 1, "ホームの施策一覧は一つの入口に統一");
  console.log("PASS: all rendered master menu entries appear exactly once on the home graph");
}
