import { formatAmount, formatRate } from "../core/domain/amounts";

/** Hide displayed zeroes without changing the underlying amount or calculation. */
export function formatTableAmount(amount: number | string | undefined): string {
  const text = formatAmount(amount);
  return text === "0" ? "" : text;
}

export function formatTableRate(amount: number | undefined, difference = false): string {
  const text = formatRate(amount, difference);
  return /^-?0\.0(?:%|pt)$/.test(text) ? "" : text;
}
