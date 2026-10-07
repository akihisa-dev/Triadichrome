export const accountTypes = {
  sales: "売上",
  cost: "売上原価",
  expense: "費用",
  profit: "利益",
} as const;

export type AccountType = keyof typeof accountTypes;

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && Object.hasOwn(accountTypes, value);
}
