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

// SQL expression: convert a transaction's amount to display currency.
// 1. If source currency matches dc → use amount directly
// 2. If destination currency matches dc → use converted_amount
// 3. Direct exchange rate lookup (closest date on or before tx, then any date)
// 4. Indirect conversion through USD: src→USD × USD→dc
// 5. Fallback: 1 (no conversion)
// Uses 5 parameter slots (dc, dc, dc, dc, dc).
const TX_TO_DC = `CASE
  WHEN t.source_currency = ? THEN t.amount
  WHEN t.destination_currency = ? THEN t.converted_amount
  ELSE t.amount * COALESCE(
    (SELECT er.rate FROM exchange_rates er
     WHERE er.base_currency = t.source_currency AND er.target_currency = ?
       AND er."date" <= t."date"
     ORDER BY er."date" DESC LIMIT 1),
    (SELECT er.rate FROM exchange_rates er
     WHERE er.base_currency = t.source_currency AND er.target_currency = ?
     ORDER BY er."date" ASC LIMIT 1),
    (SELECT
      (SELECT er.rate FROM exchange_rates er
       WHERE er.base_currency = t.source_currency AND er.target_currency = 'USD'
       ORDER BY er."date" DESC LIMIT 1)
      *
      (SELECT er.rate FROM exchange_rates er
       WHERE er.base_currency = 'USD' AND er.target_currency = ?
       ORDER BY er."date" DESC LIMIT 1)
    ),
    1)
END`

// Helper: repeat dc value for N usages of TX_TO_DC (5 params each)
function dcParams(dc: string, txCount: number): string[] {
  return Array(txCount * 5).fill(dc)
}

export function getSpendingByCategory(db: Database, dateFrom: string, dateTo: string, dc: string): CategorySpending[] {
  const result = db.exec(
    `SELECT st.name, st.color, st.icon,
       SUM(${TX_TO_DC}) as total
     FROM transactions t
     JOIN spending_types st ON t.destination_spending_type_id = st.id
     WHERE t.type = 'spending' AND t.date BETWEEN ? AND ?
     GROUP BY st.id
     ORDER BY total DESC`,
    [...dcParams(dc, 1), dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    name: row[0] as string,
    color: row[1] as string,
    icon: row[2] as string,
    total: row[3] as number,
  }))
}

export function getMonthlyTotals(db: Database, dateFrom: string, dateTo: string, dc: string): MonthlyTotal[] {
  const result = db.exec(
    `SELECT strftime('%Y-%m', t.date) as month, t.type,
       SUM(${TX_TO_DC}) as total
     FROM transactions t
     WHERE t.type IN ('earning', 'spending')
       AND t.date BETWEEN ? AND ?
     GROUP BY month, t.type
     ORDER BY month`,
    [...dcParams(dc, 1), dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    month: row[0] as string,
    type: row[1] as string,
    total: row[2] as number,
  }))
}

export function getPeriodSummary(db: Database, dateFrom: string, dateTo: string, dc: string): PeriodSummary {
  const result = db.exec(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'earning' THEN ${TX_TO_DC} ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN t.type = 'spending' THEN ${TX_TO_DC} ELSE 0 END), 0) as total_expense,
       COUNT(*) as tx_count
     FROM transactions t
     WHERE t.date BETWEEN ? AND ?`,
    [...dcParams(dc, 2), dateFrom, dateTo],
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

export function getDailySpending(db: Database, dateFrom: string, dateTo: string, dc: string): DailyTotal[] {
  const result = db.exec(
    `SELECT t.date,
       SUM(${TX_TO_DC}) as total
     FROM transactions t
     WHERE t.type = 'spending' AND t.date BETWEEN ? AND ?
     GROUP BY t.date
     ORDER BY t.date`,
    [...dcParams(dc, 1), dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    date: row[0] as string,
    total: row[1] as number,
  }))
}

export function getTagDistribution(db: Database, dateFrom: string, dateTo: string, dc: string): TagTotal[] {
  const result = db.exec(
    `SELECT tg.name, tg.color,
       SUM(${TX_TO_DC}) as total, COUNT(*) as count
     FROM transaction_tags tt
     JOIN transactions t ON tt.transaction_id = t.id
     JOIN tags tg ON tt.tag_id = tg.id
     WHERE t.date BETWEEN ? AND ?
     GROUP BY tg.id
     ORDER BY total DESC`,
    [...dcParams(dc, 1), dateFrom, dateTo],
  )
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    name: row[0] as string,
    color: row[1] as string,
    total: row[2] as number,
    count: row[3] as number,
  }))
}

export function getBudgetBalanceTrend(db: Database, dateFrom: string, dateTo: string, dc: string): BalancePoint[] {
  // Base: sum of all active budgets' initial balances, converted to display currency
  // Also uses indirect USD conversion for budget currencies
  const baseResult = db.exec(
    `SELECT COALESCE(SUM(
       CASE WHEN b.currency = ? THEN b.initial_balance
       ELSE b.initial_balance * COALESCE(
         (SELECT er.rate FROM exchange_rates er
          WHERE er.base_currency = b.currency AND er.target_currency = ?
          ORDER BY er."date" DESC LIMIT 1),
         (SELECT
           (SELECT er.rate FROM exchange_rates er
            WHERE er.base_currency = b.currency AND er.target_currency = 'USD'
            ORDER BY er."date" DESC LIMIT 1)
           *
           (SELECT er.rate FROM exchange_rates er
            WHERE er.base_currency = 'USD' AND er.target_currency = ?
            ORDER BY er."date" DESC LIMIT 1)
         ),
         1)
       END
     ), 0) FROM budgets b WHERE b.is_active = 1`,
    [dc, dc, dc],
  )
  const base = baseResult.length > 0 ? (baseResult[0]!.values[0]![0] as number) : 0

  // Monthly net changes, converted to display currency
  const result = db.exec(
    `SELECT strftime('%Y-%m', t.date) as month,
       SUM(CASE WHEN t.destination_budget_id IS NOT NULL THEN ${TX_TO_DC} ELSE 0 END)
       - SUM(CASE WHEN t.source_budget_id IS NOT NULL THEN ${TX_TO_DC} ELSE 0 END) as net_change
     FROM transactions t
     WHERE t.date <= ?
     GROUP BY month
     ORDER BY month`,
    [...dcParams(dc, 2), dateTo],
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

export interface MonthlyExpense {
  month: string
  total: number
}

export function getFilteredMonthlyExpenses(
  db: Database,
  dateFrom: string,
  dateTo: string,
  dc: string,
  tagIds?: number[],
  spendingTypeIds?: number[],
): MonthlyExpense[] {
  const joins: string[] = []
  const conditions: string[] = ["t.type = 'spending'", "t.date BETWEEN ? AND ?"]
  const params: (string | number)[] = [...dcParams(dc, 1)]

  if (tagIds && tagIds.length > 0) {
    joins.push('JOIN transaction_tags tt ON tt.transaction_id = t.id')
    conditions.push(`tt.tag_id IN (${tagIds.map(() => '?').join(',')})`)
    params.push(...tagIds)
  }

  if (spendingTypeIds && spendingTypeIds.length > 0) {
    conditions.push(`t.destination_spending_type_id IN (${spendingTypeIds.map(() => '?').join(',')})`)
    params.push(...spendingTypeIds)
  }

  params.push(dateFrom, dateTo)

  const sql = `SELECT strftime('%Y-%m', t."date") as month,
     SUM(${TX_TO_DC}) as total
   FROM transactions t
   ${joins.join(' ')}
   WHERE ${conditions.join(' AND ')}
   GROUP BY month
   ORDER BY month`

  const result = db.exec(sql, params)
  if (result.length === 0) return []
  return result[0]!.values.map((row) => ({
    month: row[0] as string,
    total: row[1] as number,
  }))
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
