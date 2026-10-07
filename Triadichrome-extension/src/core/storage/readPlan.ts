import type { Database } from "sql.js";
import { openTriadicDatabase, openBusinessSnapshot } from "./triadicDatabase";
import { yenToAmount } from "../domain/amounts";
import { INITIAL_KINDS, type KindOverrides } from "../domain/kinds";
import type { Initiative, InitiativeRow, PlanContents } from "../domain/plan";
import { initiativesForKind } from "../tables/initiatives";
import { buildDetails } from "../tables/details";
import { readPlanSettings } from "./settings";
import { listAccounts } from "./accountMaster";
import { listAggregations } from "./aggregations";
import { listExpansions } from "./expansionMaster";
import { listIndustries } from "./industryMaster";
import { listDepartments } from "./departmentMaster";
import { listPeriodTypes } from "./periodMaster";
export function listInitiatives(db: Database, fiscalYear: number): Initiative[] {
  const rowsByOwner = new Map<number, InitiativeRow[]>();
  const rowsById = new Map<string, InitiativeRow>();
  for (const [id, owner, account, order, revision] of db.exec("SELECT id, initiative_id, account_id, sort_order, revision FROM initiative_rows ORDER BY sort_order, id")[0]?.values ?? []) {
    void order;
    const row: InitiativeRow = { id: String(id), accountId: Number(account), revision: Number(revision), amounts: {}, overrides: {}, amountRevisions: {}, overrideRevisions: {} };
    const ownerId = Number(owner);
    const rows = rowsByOwner.get(ownerId) ?? [];
    rows.push(row); rowsByOwner.set(ownerId, rows); rowsById.set(String(id), row);
  }
  for (const [id, month, amount, revision] of db.exec("SELECT row_id, month, amount_yen, revision FROM initiative_amounts")[0]?.values ?? []) {
    const row = rowsById.get(String(id))!;
    row.amounts[Number(month) as keyof typeof row.amounts] = yenToAmount(Number(amount)); row.amountRevisions![Number(month)] = Number(revision);
  }
  for (const [id, month, amount, revision] of db.exec("SELECT row_id, month, amount_yen, revision FROM amount_overrides")[0]?.values ?? []) {
    const row = rowsById.get(String(id))!;
    const overrides = row.overrides as KindOverrides;
    (overrides[2] ??= {})[Number(month)] = yenToAmount(Number(amount)); row.overrideRevisions![Number(month)] = Number(revision);
  }
  return (db.exec("SELECT id, name, note, expansion_id, department_id, period_type_id, industry_id, revision FROM initiatives ORDER BY sort_order, id")[0]?.values ?? [])
    .map(([id, name, note, expansion, department, period, industry, revision]) => ({ id: Number(id), name: String(name), note: String(note), expansionId: Number(expansion), departmentId: Number(department), periodTypeId: period === null ? null : Number(period), industryId: Number(industry), fiscalYear, revision: Number(revision), rows: rowsByOwner.get(Number(id)) ?? [], months: {} }));
}
export function readContents(db: Database): PlanContents {
  const settings = readPlanSettings(db);
  const accounts = listAccounts(db);
  const contents: PlanContents = { ...settings, accounts, initiatives: initiativesForKind(listInitiatives(db, settings.fiscalYear), accounts, 1),
    aggregations: listAggregations(db), expansions: listExpansions(db), industries: listIndustries(db), departments: listDepartments(db), periodTypes: listPeriodTypes(db), kinds: INITIAL_KINDS.map(kind => ({ ...kind })) };
  return { ...contents, details: buildDetails(contents) };
}
async function read(bytes: Uint8Array, open: typeof openTriadicDatabase): Promise<PlanContents> {
  const db = await open(bytes);
  try { return readContents(db); } finally { db.close(); }
}
export const readPlanContents = (bytes: Uint8Array) => read(bytes, openTriadicDatabase);
export const readSnapshotContents = (bytes: Uint8Array) => read(bytes, openBusinessSnapshot);
