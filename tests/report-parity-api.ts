export * from './core-api';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CostTablePage } from '../Triadichrome-extension/src/extension/CostTablePage';
import { ExpansionTablePage } from '../Triadichrome-extension/src/extension/ExpansionTablePage';
import { InitiativeListPage } from '../Triadichrome-extension/src/extension/InitiativeListPage';
import type { PlanContents } from '../Triadichrome-extension/src/core/domain/plan';
import type { KindId } from '../Triadichrome-extension/src/core/domain/kinds';
export function renderReportTables(contents: PlanContents, selected: KindId[], kind: KindId, costContents = contents) {
  return {
    総原価表: renderToStaticMarkup(createElement(CostTablePage, { contents: costContents, selected, selection: null })),
    展開表: renderToStaticMarkup(createElement(ExpansionTablePage, { contents, selected, selection: null, onOpenInitiative() {} })),
    施策一覧: renderToStaticMarkup(createElement(InitiativeListPage, { selection: null, selectedKind: kind,
      initiatives: contents.initiatives, accounts: contents.accounts, expansions: contents.expansions,
      periodTypes: contents.periodTypes, fiscalYear: String(contents.fiscalYear), onAddInitiative() {},
      onOpenInitiative() {}, navigationBlocked: false })),
  };
}
