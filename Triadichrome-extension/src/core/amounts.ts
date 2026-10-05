/** Amounts are entered and stored in thousands of yen, down to one yen. */
const amountPattern = /^[+-]?(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/;
export function isValidAmount(text: string): boolean {
  return amountPattern.test(text.trim()) && Number.isFinite(Number(text)) && Number.isSafeInteger(Math.round(Number(text) * 1000));
}
export function addAmounts(left: number, right: number): number {
  // Integer yen arithmetic prevents errors such as 0.1 + 0.2 = 0.30000000000000004.
  const yen = Math.round(left * 1000) + Math.round(right * 1000);
  if (!Number.isSafeInteger(yen)) throw new Error("金額の合計が正確に計算できる範囲を超えています。");
  return yen / 1000;
}
const amountFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 });
const rateFormat = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatAmount = (amount: number | undefined) => amount === undefined ? "" : amountFormat.format(amount);
export const formatRate = (amount: number | undefined, difference = false) => amount === undefined ? "" : `${rateFormat.format(amount)}${difference ? "pt" : "%"}`;
