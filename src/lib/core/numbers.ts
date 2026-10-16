// Numbers as written in a language, with the thousands separator from 1,000 up: Italian
// and Spanish leave four-digit numbers ungrouped by default ("1234"), which reads oddly
// next to "12.345" in the same column.

export function formatNumber(n: number, language: string, maximumFractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(language || undefined, { maximumFractionDigits, useGrouping: "always" } as Intl.NumberFormatOptions).format(n);
  } catch {
    return n.toLocaleString(undefined, { maximumFractionDigits });
  }
}
