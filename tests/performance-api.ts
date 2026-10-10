export * from './core-api';
export { initializeSqlite } from '../Triadichrome-extension/src/core/storage/sqliteRuntime';
export { visibleRows } from '../Triadichrome-extension/src/core/tables/visibleRows';
export { processingTasks } from '../Triadichrome-extension/src/extension/planProcessingTasks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeListPage } from '../Triadichrome-extension/src/extension/InitiativeListPage';
import type { KindId } from '../Triadichrome-extension/src/core/domain/kinds';
import type { PlanContents } from '../Triadichrome-extension/src/core/domain/plan';
export function renderInitiativeList(contents: PlanContents, selectedKind: KindId = 1) {
  return renderToStaticMarkup(createElement(InitiativeListPage, {
    selection: null, selectedKind, initiatives: contents.initiatives, accounts: contents.accounts,
    expansions: contents.expansions, periodTypes: contents.periodTypes,
    fiscalYear: String(contents.fiscalYear), onAddInitiative() {}, onOpenInitiative() {}, navigationBlocked: false,
  }));
}

export { createInitiativeListView } from "../Triadichrome-extension/src/core/tables/initiativeListView";
export { createExpansionTableView } from "../Triadichrome-extension/src/core/tables/expansionTableView";
