/** Format cents (integer) as a currency string */
export function formatCents(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Format cents as a compact currency string (narrow symbol) */
export function formatCentsCompact(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Format cents with k/m shortening for large amounts */
export function formatCentsShort(cents: number, currency: string): string {
  const abs = Math.abs(cents) / 100
  if (abs < 1000) return formatCents(cents, currency)
  let shortened: number
  let suffix: string
  if (abs >= 1_000_000) {
    shortened = Math.round((cents / 100) / 100_000) / 10
    suffix = 'm'
  } else {
    shortened = Math.round((cents / 100) / 100) / 10
    suffix = 'k'
  }
  const str = shortened % 1 === 0 ? shortened.toFixed(0) : shortened.toFixed(1)
  return `${str}${suffix} ${currency}`
}
