export type DetailTarget = {
  source: "initiative"; rowId: string; initiativeId: number; kindId: 1 | 2; month: number;
  initiativeRevision: number; rowRevision: number; revision: number;
} | {
  source: "previous"; previousId: number; revision: number;
};
type DetailValues = {
  id: string; rowId: string; initiativeId: number; kindId: number; month: number;
  initiativeRevision: number; rowRevision: number; revision: number;
  kindName: string; industryId: number | null; initiativeName: string; note: string;
  fiscalYear: number; year: number; expansionId: number | null; departmentId: number | null; periodTypeId: number | null;
  startYearMonth: string | null;
  accountId: number; accountCode: string | null; accountName: string; accountType: string | null;
  amount: string; sales: string | null; profit: string | null; initiativeOrder: number; rowOrder: number;
};
export type DetailRecord = DetailValues & DetailTarget;
export type DetailField = "name" | "note" | "fiscalYear" | "expansionId" | "departmentId" | "periodTypeId" | "industryId" | "accountId" | "amount";
export type DetailChange = { target: DetailTarget; field: DetailField; value: string };
export function detailKey(target: DetailTarget): string {
  return target.source === "previous" ? `previous:${target.previousId}` : `initiative:${target.rowId}:${target.kindId}:${target.month}`;
}
