/** Amounts are entered in thousands of yen and stored as integer yen. */
const amountPattern = /^[+-]?(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/;
export function isValidAmount(text: string): boolean {
  try { amountToYen(text); return true; } catch { return false; }
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

/** Parse decimal thousands without a floating-point multiply or silent rounding. */
export function amountToYen(text: string): number {
  const value = text.trim();
  if (!amountPattern.test(value)) throw new Error("金額は千円単位・小数点以下3桁までで入力してください。");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const integer = BigInt(whole || "0") * 1000n + BigInt(fraction.padEnd(3, "0"));
  const signed = negative ? -integer : integer;
  if (signed < -9007199254740991n || signed > 9007199254740991n) throw new Error("金額が正確に計算できる範囲を超えています。");
  return Number(signed);
}

export function yenToAmount(yen: number): string {
  if (!Number.isSafeInteger(yen)) throw new Error("金額が正確に計算できる範囲を超えています。");
  const value = BigInt(yen);
  const positive = value < 0n ? -value : value;
  const fraction = String(positive % 1000n).padStart(3, "0").replace(/0+$/, "");
  return `${value < 0n ? "-" : ""}${positive / 1000n}${fraction ? `.${fraction}` : ""}`;
}
