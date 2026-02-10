import type { Database } from 'sql.js'
import { getActiveUserCurrencies, upsertExchangeRate } from '@/db/queries/exchangeRates'
import { getSetting } from '@/db/queries/settings'

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'
const FALLBACK_BASE = 'https://latest.currency-api.pages.dev/v1/currencies'

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Check if we already have today's rates for all cross-pairs among the given currencies */
function hasRatesForToday(db: Database, currencies: string[]): boolean {
  if (currencies.length < 2) return true
  const today = getToday()
  const placeholders = currencies.map(() => '?').join(',')
  const result = db.exec(
    `SELECT COUNT(DISTINCT base_currency || '-' || target_currency)
     FROM exchange_rates
     WHERE "date" = ? AND base_currency IN (${placeholders}) AND target_currency IN (${placeholders})`,
    [today, ...currencies, ...currencies],
  )
  const count = result.length > 0 ? (result[0]!.values[0]![0] as number) : 0
  const expected = currencies.length * (currencies.length - 1)
  return count >= expected
}

async function fetchRatesForBase(base: string): Promise<Record<string, number> | null> {
  const lc = base.toLowerCase()
  try {
    const res = await fetch(`${CDN_BASE}/${lc}.json`)
    if (res.ok) {
      const data = await res.json()
      return data?.[lc] ?? null
    }
  } catch { /* CDN failed */ }

  try {
    const res = await fetch(`${FALLBACK_BASE}/${lc}.json`)
    if (res.ok) {
      const data = await res.json()
      return data?.[lc] ?? null
    }
  } catch { /* fallback failed */ }

  return null
}

/**
 * Fetch and store exchange rates for all active currencies.
 * Skips if today's rates already exist for all pairs.
 */
export async function refreshExchangeRates(
  db: Database,
  persistFn: () => void,
): Promise<void> {
  const active = getActiveUserCurrencies(db)
  const dc = getSetting(db, 'display_currency') ?? 'USD'

  // Build unique currency set, always include USD for indirect conversions
  const currencySet = new Set(active.map(c => c.toUpperCase()))
  currencySet.add(dc.toUpperCase())
  currencySet.add('USD')
  const currencies = [...currencySet]

  if (currencies.length < 2) return
  if (hasRatesForToday(db, currencies)) return

  const today = getToday()
  let stored = 0

  for (const base of currencies) {
    const rates = await fetchRatesForBase(base)
    if (!rates) continue

    for (const target of currencies) {
      if (target === base) continue
      const rate = rates[target.toLowerCase()]
      if (rate != null && rate > 0) {
        upsertExchangeRate(db, {
          base_currency: base,
          target_currency: target,
          rate,
          date: today,
        })
        stored++
      }
    }
  }

  if (stored > 0) {
    persistFn()
  }
}
