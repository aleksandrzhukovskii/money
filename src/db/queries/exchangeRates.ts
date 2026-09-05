import type { Database } from 'sql.js'

export function getExchangeRate(
  db: Database,
  baseCurrency: string,
  targetCurrency: string,
  date?: string,
): number | null {
  const sql = date
    ? 'SELECT rate FROM exchange_rates WHERE base_currency = ? AND target_currency = ? AND date = ? LIMIT 1'
    : 'SELECT rate FROM exchange_rates WHERE base_currency = ? AND target_currency = ? ORDER BY date DESC LIMIT 1'
  const params = date ? [baseCurrency, targetCurrency, date] : [baseCurrency, targetCurrency]
  const result = db.exec(sql, params)
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return result[0]!.values[0]![0] as number
}

/**
 * Rate for a pair as of a date, taking the most recent one on or before it and
 * falling back to any rate for the pair. Matches how statistics convert
 * historical transactions — an exact-date lookup almost never hits for rows
 * imported from an old statement.
 */
export function getExchangeRateAsOf(
  db: Database,
  baseCurrency: string,
  targetCurrency: string,
  date: string,
): number | null {
  const onOrBefore = db.exec(
    `SELECT rate FROM exchange_rates
     WHERE base_currency = ? AND target_currency = ? AND "date" <= ?
     ORDER BY "date" DESC LIMIT 1`,
    [baseCurrency, targetCurrency, date],
  )
  if (onOrBefore.length > 0 && onOrBefore[0]!.values.length > 0) {
    return onOrBefore[0]!.values[0]![0] as number
  }
  return getExchangeRate(db, baseCurrency, targetCurrency)
}

export function upsertExchangeRate(
  db: Database,
  data: { base_currency: string; target_currency: string; rate: number; date: string },
): void {
  db.run(
    `INSERT INTO exchange_rates (base_currency, target_currency, rate, date, fetched_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(base_currency, target_currency, date)
     DO UPDATE SET rate = ?, fetched_at = datetime('now')`,
    [data.base_currency, data.target_currency, data.rate, data.date, data.rate],
  )
}

export function getActiveUserCurrencies(db: Database): string[] {
  const result = db.exec(`
    SELECT DISTINCT currency FROM (
      SELECT currency FROM incomes WHERE is_active = 1
      UNION
      SELECT currency FROM budgets WHERE is_active = 1
      UNION
      SELECT currency FROM spending_types WHERE is_active = 1
    )
  `)
  if (result.length === 0) return []
  return result[0]!.values.map((row) => row[0] as string)
}
