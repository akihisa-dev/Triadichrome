import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function verifyHomeMasterCoverage({ MasterPage, HomeRelationsPage }) {
  const menu = renderToStaticMarkup(createElement(MasterPage, {}));
  const graph = renderToStaticMarkup(createElement(HomeRelationsPage, { view: { current: null }, disabled: false, onNavigate() {} }));
  const menuNames = [...menu.matchAll(/<strong>([^<]+)<\/strong>/g)].map(match => match[1]);
  const graphNames = [...graph.matchAll(/<button[^>]*class="home-relation-node is-master[^\"]*"[^>]*>[\s\S]*?<span class="home-relation-name">([^<]+)<\/span><\/button>/g)].map(match => match[1]);
  assert.ok(menuNames.length > 0, "マスタ入口の項目を取得できる");
  assert.equal(new Set(graphNames).size, graphNames.length, "相関図のマスタを重複表示しない");
  assert.deepEqual(graphNames.toSorted(), menuNames.toSorted(), "マスタ入口とホームの全マスタが一致する（追加漏れ・余分な項目を拒否）");
  assert.ok(!graph.includes('data-page="initiative-entry"'), "新規登録の直通入口をホームへ残さない");
  assert.equal([...graph.matchAll(/data-page="initiative-list"/g)].length, 1, "ホームの施策一覧は一つの入口に統一");
  console.log("PASS: all rendered master menu entries appear exactly once on the home graph");
}
