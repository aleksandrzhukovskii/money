import type { Database } from 'sql.js'

export interface CategorySpending {
  name: string
  color: string
  icon: string
  total: number
}

export interface MonthlyTotal {
  month: string
  type: string
  total: number
}

export interface PeriodSummary {
  total_income: number
  total_expense: number
  tx_count: number
}

export interface DailyTotal {
  date: string
  total: number
}

export interface TagTotal {
  name: string
  color: string
  total: number
  count: number
}

export interface CurrencyHolding {
  currency: string
  total: number
}

export interface BalancePoint {
  month: string
  total: number
}

export function getSpendingByCategory(db: Database, dateFrom: string, dateTo: string): CategorySpending[] {
  const result = db.exec(
    `SELECT st.name, st.color, st.icon,
       SUM(CASE
         WHEN t.destination_currency IS NOT NULL THEN t.converted_amount
         ELSE t.amount
       END) as total
     FROM transactions t
     JOIN spending_types st ON t.destination_spending_type_id = st.id
     WHERE t.type = 'spending' AND t.date BETWEEN ? AND ?
     GROUP BY st.id
     ORDER BY total DESC`,
    [dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    name: row[0] as string,
    color: row[1] as string,
    icon: row[2] as string,
    total: row[3] as number,
  }))
}

export function getMonthlyTotals(db: Database, dateFrom: string, dateTo: string): MonthlyTotal[] {
  const result = db.exec(
    `SELECT strftime('%Y-%m', t.date) as month, t.type, SUM(t.amount) as total
     FROM transactions t
     WHERE t.type IN ('earning', 'spending')
       AND t.date BETWEEN ? AND ?
     GROUP BY month, t.type
     ORDER BY month`,
    [dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    month: row[0] as string,
    type: row[1] as string,
    total: row[2] as number,
  }))
}

export function getPeriodSummary(db: Database, dateFrom: string, dateTo: string): PeriodSummary {
  const result = db.exec(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN type = 'spending' THEN amount ELSE 0 END), 0) as total_expense,
       COUNT(*) as tx_count
     FROM transactions
     WHERE date BETWEEN ? AND ?`,
    [dateFrom, dateTo],
  )
  if (result.length === 0 || result[0]!.values.length === 0) {
    return { total_income: 0, total_expense: 0, tx_count: 0 }
  }
  const row = result[0]!.values[0]!
  return {
    total_income: row[0] as number,
    total_expense: row[1] as number,
    tx_count: row[2] as number,
  }
}

export function getDailySpending(db: Database, dateFrom: string, dateTo: string): DailyTotal[] {
  const result = db.exec(
    `SELECT date, SUM(amount) as total
     FROM transactions
     WHERE type = 'spending' AND date BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date`,
    [dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    date: row[0] as string,
    total: row[1] as number,
  }))
}

export function getTagDistribution(db: Database, dateFrom: string, dateTo: string): TagTotal[] {
  const result = db.exec(
    `SELECT tg.name, tg.color, SUM(t.amount) as total, COUNT(*) as count
     FROM transaction_tags tt
     JOIN transactions t ON tt.transaction_id = t.id
     JOIN tags tg ON tt.tag_id = tg.id
     WHERE t.date BETWEEN ? AND ?
     GROUP BY tg.id
     ORDER BY total DESC`,
    [dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    name: row[0] as string,
    color: row[1] as string,
    total: row[2] as number,
    count: row[3] as number,
  }))
}

export function getBudgetBalanceTrend(db: Database, dateFrom: string, dateTo: string): BalancePoint[] {
  // Base: sum of all active budgets' initial balances
  const baseResult = db.exec(
    `SELECT COALESCE(SUM(initial_balance), 0) FROM budgets WHERE is_active = 1`,
  )
  const base = baseResult.length > 0 ? (baseResult[0]!.values[0]![0] as number) : 0

  // Monthly net changes from the beginning of time up through dateTo
  const result = db.exec(
    `SELECT strftime('%Y-%m', date) as month,
       SUM(CASE WHEN destination_budget_id IS NOT NULL THEN
         CASE WHEN destination_currency IS NOT NULL THEN converted_amount ELSE amount END
       ELSE 0 END)
       - SUM(CASE WHEN source_budget_id IS NOT NULL THEN amount ELSE 0 END) as net_change
     FROM transactions
     WHERE date <= ?
     GROUP BY month
     ORDER BY month`,
    [dateTo],
  )

  if (result.length === 0) return [{ month: dateFrom.slice(0, 7), total: base }]

  const monthlyChanges = result[0]!.values.map((row) => ({
    month: row[0] as string,
    netChange: row[1] as number,
  }))

  // Compute running total, filter to requested range
  const rangeStart = dateFrom.slice(0, 7)
  const points: BalancePoint[] = []
  let running = base

  for (const { month, netChange } of monthlyChanges) {
    running += netChange
    if (month >= rangeStart) {
      points.push({ month, total: running })
    }
  }

  return points
}

export function getCurrencyHoldings(db: Database): CurrencyHolding[] {
  const result = db.exec(`
    SELECT b.currency,
      SUM(
        b.initial_balance
        + COALESCE((SELECT SUM(
            CASE WHEN t.destination_currency IS NOT NULL THEN t.converted_amount ELSE t.amount END
          ) FROM transactions t WHERE t.destination_budget_id = b.id), 0)
        - COALESCE((SELECT SUM(t.amount)
          FROM transactions t WHERE t.source_budget_id = b.id), 0)
      ) as total
    FROM budgets b
    WHERE b.is_active = 1
    GROUP BY b.currency
    ORDER BY total DESC
  `)
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    currency: row[0] as string,
    total: row[1] as number,
  }))
}
