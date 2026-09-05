import type { Database } from 'sql.js'
import { getBudgetsWithBalances } from '@/db/queries/budgets'
import { getIncomes } from '@/db/queries/incomes'
import { getSpendingTypes } from '@/db/queries/spendingTypes'
import { getExchangeRateAsOf } from '@/db/queries/exchangeRates'
import { insertTransaction, getTransactionsForEntity } from '@/db/queries/transactions'
import type { TransactionType } from '@/types/database'

/**
 * Import path for files produced by `tools/statement`.
 *
 * Deliberately unlike the CSV import, which wipes the database and recreates
 * every entity: this one creates nothing and appends. Anything naming an entity
 * that doesn't already exist is a blocking error, so a typo in the tool can't
 * quietly spawn a duplicate budget.
 */

export interface StatementRow {
  date: string
  type: TransactionType
  from: string
  to: string
  amount: number
  currency: string
  converted_amount: number | null
  converted_currency: string | null
  tags: string[] | null
  comment: string
  source_lines: number[]
}

export interface StatementFile {
  version: number
  source_file?: string
  generated_at?: string
  rows: StatementRow[]
}

export interface RowProblem {
  index: number
  sourceLines: number[]
  message: string
}

export interface BudgetDelta {
  name: string
  currency: string
  current: number // cents
  delta: number // cents
  projected: number // cents
}

export interface ResolvedRow {
  row: StatementRow
  sourceIncomeId: number | null
  sourceBudgetId: number | null
  destBudgetId: number | null
  destSpendingTypeId: number | null
  /** Filled from exchange_rates when the file didn't carry a converted amount. */
  convertedAmount: number | null
  convertedCurrency: string | null
  exchangeRate: number | null
  rateSource: 'file' | 'database' | 'none' | 'not-needed'
}

export interface Preview {
  rows: ResolvedRow[]
  errors: RowProblem[]
  warnings: RowProblem[]
  budgetDeltas: BudgetDelta[]
  dateFrom: string
  dateTo: string
}

const VALID_TYPES: TransactionType[] = ['earning', 'spending', 'transfer']

export function parseStatementFile(text: string): StatementFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error(`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Expected a JSON object')
  }
  const file = parsed as Partial<StatementFile>
  if (file.version !== 1) {
    throw new Error(`Unsupported file version ${String(file.version)} — expected 1`)
  }
  if (!Array.isArray(file.rows)) {
    throw new Error('Missing "rows" array')
  }
  return file as StatementFile
}

function norm(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Resolve every row against the current database and work out what importing
 * would do. Nothing is written.
 */
export function buildPreview(db: Database, file: StatementFile): Preview {
  const budgets = getBudgetsWithBalances(db, true)
  const incomes = getIncomes(db, true)
  const spendingTypes = getSpendingTypes(db, true)

  const budgetByName = new Map(budgets.map((b) => [norm(b.name), b]))
  const incomeByName = new Map(incomes.map((i) => [norm(i.name), i]))
  const spendingByName = new Map(spendingTypes.map((s) => [norm(s.name), s]))

  const errors: RowProblem[] = []
  const warnings: RowProblem[] = []
  const resolved: ResolvedRow[] = []
  const deltaByBudget = new Map<number, number>()

  file.rows.forEach((row, index) => {
    const fail = (message: string) =>
      errors.push({ index, sourceLines: row.source_lines ?? [], message })
    const warn = (message: string) =>
      warnings.push({ index, sourceLines: row.source_lines ?? [], message })

    if (!VALID_TYPES.includes(row.type)) {
      fail(`Unknown transaction type "${row.type}"`)
      return
    }
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      fail(`Invalid date "${row.date}" — expected YYYY-MM-DD`)
      return
    }
    if (!(row.amount > 0)) {
      fail(`Amount must be greater than zero, got ${row.amount}`)
      return
    }

    let sourceIncomeId: number | null = null
    let sourceBudgetId: number | null = null
    let destBudgetId: number | null = null
    let destSpendingTypeId: number | null = null
    let sourceCurrency = ''
    let destCurrency = ''

    if (row.type === 'earning') {
      const income = incomeByName.get(norm(row.from))
      if (!income) {
        fail(`No income named "${row.from}"`)
        return
      }
      sourceIncomeId = income.id
      sourceCurrency = income.currency
    } else {
      const budget = budgetByName.get(norm(row.from))
      if (!budget) {
        fail(`No budget named "${row.from}"`)
        return
      }
      sourceBudgetId = budget.id
      sourceCurrency = budget.currency
    }

    if (row.type === 'spending') {
      const spending = spendingByName.get(norm(row.to))
      if (!spending) {
        fail(`No spending type named "${row.to}"`)
        return
      }
      destSpendingTypeId = spending.id
      destCurrency = spending.currency
    } else {
      const budget = budgetByName.get(norm(row.to))
      if (!budget) {
        fail(`No budget named "${row.to}"`)
        return
      }
      destBudgetId = budget.id
      destCurrency = budget.currency
    }

    // The file states which currency the amount is in; it must agree with the
    // entity it's leaving, or the balance maths would be silently wrong.
    if (row.currency && sourceCurrency && norm(row.currency) !== norm(sourceCurrency)) {
      fail(`Row is in ${row.currency} but "${row.from}" is ${sourceCurrency}`)
      return
    }

    // Cross-currency: prefer the file's converted amount, else fall back to the
    // stored rate for that date, as the rest of the app does.
    const isCross = !!destCurrency && norm(destCurrency) !== norm(sourceCurrency)
    let convertedAmount: number | null = null
    let convertedCurrency: string | null = null
    let exchangeRate: number | null = null
    let rateSource: ResolvedRow['rateSource'] = 'not-needed'

    if (isCross) {
      convertedCurrency = destCurrency
      if (row.converted_amount != null && row.converted_amount > 0) {
        convertedAmount = row.converted_amount
        exchangeRate = row.converted_amount / row.amount
        rateSource = 'file'
        if (row.converted_currency && norm(row.converted_currency) !== norm(destCurrency)) {
          fail(`Converted amount is ${row.converted_currency} but "${row.to}" is ${destCurrency}`)
          return
        }
      } else {
        const rate = getExchangeRateAsOf(db, sourceCurrency, destCurrency, row.date)
        if (rate != null && rate > 0) {
          convertedAmount = Math.round(row.amount * rate * 100) / 100
          exchangeRate = rate
          rateSource = 'database'
        } else {
          rateSource = 'none'
          warn(`No ${sourceCurrency}→${destCurrency} rate on or before ${row.date}; importing without a converted amount`)
        }
      }
    }

    if (looksDuplicated(db, row, sourceBudgetId, destBudgetId, destSpendingTypeId)) {
      warn('A transaction with the same date, amount and comment already exists')
    }

    // Budget balances: outflow at face value, inflow at the converted value when
    // the currencies differ. Mirrors getBudgetsWithBalances.
    const amountCents = Math.round(row.amount * 100)
    const inflowCents =
      convertedAmount != null ? Math.round(convertedAmount * 100) : amountCents
    if (sourceBudgetId != null) {
      deltaByBudget.set(sourceBudgetId, (deltaByBudget.get(sourceBudgetId) ?? 0) - amountCents)
    }
    if (destBudgetId != null) {
      deltaByBudget.set(destBudgetId, (deltaByBudget.get(destBudgetId) ?? 0) + inflowCents)
    }

    resolved.push({
      row,
      sourceIncomeId,
      sourceBudgetId,
      destBudgetId,
      destSpendingTypeId,
      convertedAmount,
      convertedCurrency,
      exchangeRate,
      rateSource,
    })
  })

  const budgetDeltas: BudgetDelta[] = budgets
    .filter((b) => deltaByBudget.has(b.id))
    .map((b) => {
      const delta = deltaByBudget.get(b.id) ?? 0
      return {
        name: b.name,
        currency: b.currency,
        current: b.current_balance,
        delta,
        projected: b.current_balance + delta,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const dates = file.rows.map((r) => r.date).filter(Boolean).sort()

  return {
    rows: resolved,
    errors,
    warnings,
    budgetDeltas,
    dateFrom: dates[0] ?? '',
    dateTo: dates[dates.length - 1] ?? '',
  }
}

/**
 * Cheap duplicate check. There is no external id on transactions, so this is a
 * heuristic warning, never a block — the user decides.
 */
function looksDuplicated(
  db: Database,
  row: StatementRow,
  sourceBudgetId: number | null,
  destBudgetId: number | null,
  destSpendingTypeId: number | null,
): boolean {
  const entityId = sourceBudgetId ?? destBudgetId ?? destSpendingTypeId
  if (entityId == null) return false
  const entityType = sourceBudgetId != null || destBudgetId != null ? 'budget' : 'spending_type'

  const existing = getTransactionsForEntity(db, entityType, entityId)
  const amountCents = Math.round(row.amount * 100)
  return existing.some(
    (t) =>
      t.date === row.date &&
      t.amount === amountCents &&
      (t.comment ?? '') === (row.comment ?? ''),
  )
}

/**
 * Append the resolved rows. Creates no entities. Wrapped in a SQL transaction so
 * a failure part-way through doesn't leave half an import behind.
 */
export function executeStatementImport(db: Database, rows: ResolvedRow[]): number {
  db.run('BEGIN')
  try {
    for (const r of rows) {
      insertTransaction(db, {
        type: r.row.type,
        source_income_id: r.sourceIncomeId,
        source_budget_id: r.sourceBudgetId,
        destination_budget_id: r.destBudgetId,
        destination_spending_type_id: r.destSpendingTypeId,
        amount: r.row.amount,
        source_currency: r.row.currency,
        converted_amount: r.convertedAmount,
        destination_currency: r.convertedCurrency,
        exchange_rate: r.exchangeRate,
        date: r.row.date,
        comment: r.row.comment,
        tag_ids: [],
      })
    }
    db.run('COMMIT')
    return rows.length
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}
