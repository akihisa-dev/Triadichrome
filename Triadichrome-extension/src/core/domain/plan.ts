import type { ExpansionCategory } from "./expansionCategoryMaster";
import type { InitiativeMonth } from "./calendar";
import type { KindOverrides, KindInvalidAmounts, PlanSettings, Kind } from "./kinds";
import type { Account } from "./accountMaster";
import type { Aggregation } from "./aggregations";
import type { Expansion } from "./expansionMaster";
import type { Industry } from "./industryMaster";
import type { Department } from "./departmentMaster";
import type { PeriodType } from "./periodMaster";
import type { DetailRecord } from "./details";
import type { InitiativeStartMonths } from "./initiativeStartMonth";
export type InitiativeRow = { id?: string; accountId: number | null; revision?: number; amountRevisions?: Partial<Record<number, number>>; overrideRevisions?: Partial<Record<number, number>>; amounts: Partial<Record<InitiativeMonth, string>>; overrides?: KindOverrides; invalidAmounts?: KindInvalidAmounts };
export type InitiativeEntryDraft = { name: string; note: string; expansionId: number | null; expansionCategoryId?: number | null; departmentId?: number | null; periodTypeId?: number | null; industryId?: number | null; fiscalYear: string; rows: InitiativeRow[]; invalidNumbers?: boolean };
export type Initiative = {
  id: number;
  name: string;
  note: string;
  expansionId: number | null; expansionCategoryId?: number | null; departmentId?: number | null; periodTypeId?: number | null; industryId?: number | null;
  fiscalYear: number | null;
  rows: InitiativeRow[];
  revision: number;
  startYearMonths: InitiativeStartMonths;
  /** Derived monetary values are integer yen; input rows remain decimal thousands. */
  months: Partial<Record<InitiativeMonth, { sales: number | null; expense: number; profit: number | null }>>;
};
export type PlanContents = PlanSettings & { accounts: Account[]; initiatives: Initiative[]; aggregations: Aggregation[]; expansions: Expansion[]; expansionCategories: ExpansionCategory[]; industries: Industry[]; departments: Department[]; periodTypes: PeriodType[]; kinds: Kind[]; details?: DetailRecord[] | undefined;  };
