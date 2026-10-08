export * from './core-api';
export { initializeSqlite } from '../Triadichrome-extension/src/core/storage/sqliteRuntime';
export { syncInitiativeStartMonths, validateInitiativeStartMonths } from '../Triadichrome-extension/src/core/storage/initiativeStartMonths';
export { visibleRows } from '../Triadichrome-extension/src/core/tables/visibleRows';
export { processingTasks } from '../Triadichrome-extension/src/extension/planProcessingTasks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeListPage } from '../Triadichrome-extension/src/extension/InitiativeListPage';
import type { PlanContents } from '../Triadichrome-extension/src/core/domain/plan';
export function renderInitiativeList(contents: PlanContents) {
  return renderToStaticMarkup(createElement(InitiativeListPage, {
    selection: null, selectedKind: 1, initiatives: contents.initiatives,
    expansions: contents.expansions, periodTypes: contents.periodTypes,
    fiscalYear: String(contents.fiscalYear), onAddInitiative() {}, onOpenInitiative() {}, navigationBlocked: false,
  }));
}
