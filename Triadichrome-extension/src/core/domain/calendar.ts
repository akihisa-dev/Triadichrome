export const initiativeMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
export type InitiativeMonth = typeof initiativeMonths[number];
export function currentFiscalYear(now = new Date()): number { return now.getFullYear() - (now.getMonth() < 3 ? 1 : 0); }
export function calendarYear(fiscalYear: number, month: number): number { return fiscalYear + (month < 4 ? 1 : 0); }
