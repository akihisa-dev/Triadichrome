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
const amountFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const rateFormat = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Round only for display; editable strings and stored yen keep all three decimals. */
export function formatAmount(amount: number | string | undefined): string {
  if (amount === undefined) return "";
  if (typeof amount === "string") {
    const yen = BigInt(amountToYen(amount));
    const absolute = yen < 0n ? -yen : yen;
    const rounded = (absolute + 500n) / 1000n;
    return amountFormat.format(yen < 0n ? -rounded : rounded);
  }
  return amountFormat.format(Math.abs(amount) < 0.5 ? 0 : amount);
}
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
