import type { Database } from 'sql.js'
import type { TransactionWithDetails, TransactionType } from '@/types/database'

export interface TransactionFilters {
  type?: TransactionType
  dateFrom?: string
  dateTo?: string
  tagIds?: number[]
  limit?: number
  offset?: number
}

export function getTransactions(db: Database, filters: TransactionFilters = {}): TransactionWithDetails[] {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters.type) {
    conditions.push('t.type = ?')
    params.push(filters.type)
  }
  if (filters.dateFrom) {
    conditions.push('t.date >= ?')
    params.push(filters.dateFrom)
  }
  if (filters.dateTo) {
    conditions.push('t.date <= ?')
    params.push(filters.dateTo)
  }
  if (filters.tagIds && filters.tagIds.length > 0) {
    conditions.push(`t.id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id IN (${filters.tagIds.map(() => '?').join(',')}))`)
    params.push(...filters.tagIds)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ? `LIMIT ${filters.limit}` : ''
  const offset = filters.offset ? `OFFSET ${filters.offset}` : ''

  const sql = `
    SELECT t.*,
      COALESCE(i.name, sb.name) as source_name,
      COALESCE(db2.name, st.name) as destination_name
    FROM transactions t
    LEFT JOIN incomes i ON t.source_income_id = i.id
    LEFT JOIN budgets sb ON t.source_budget_id = sb.id
    LEFT JOIN budgets db2 ON t.destination_budget_id = db2.id
    LEFT JOIN spending_types st ON t.destination_spending_type_id = st.id
    ${where}
    ORDER BY t.date DESC, t.created_at DESC
    ${limit} ${offset}
  `

  const result = db.exec(sql, params)
  if (result.length === 0) return []

  const columns = result[0]!.columns
  const transactions = result[0]!.values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as unknown as TransactionWithDetails
  })

  // Fetch tags for each transaction
  for (const tx of transactions) {
    const tagResult = db.exec(
      'SELECT t.name FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id WHERE tt.transaction_id = ?',
      [tx.id],
    )
    tx.tags = tagResult.length > 0
      ? tagResult[0]!.values.map((r) => r[0] as string)
      : []
  }

  return transactions
}

export function getTransactionById(db: Database, id: number): TransactionWithDetails | null {
  const sql = `
    SELECT t.*,
      COALESCE(i.name, sb.name) as source_name,
      COALESCE(db2.name, st.name) as destination_name
    FROM transactions t
    LEFT JOIN incomes i ON t.source_income_id = i.id
    LEFT JOIN budgets sb ON t.source_budget_id = sb.id
    LEFT JOIN budgets db2 ON t.destination_budget_id = db2.id
    LEFT JOIN spending_types st ON t.destination_spending_type_id = st.id
    WHERE t.id = ?
  `
  const result = db.exec(sql, [id])
  if (result.length === 0 || result[0]!.values.length === 0) return null

  const columns = result[0]!.columns
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = result[0]!.values[0]![i] })
  const tx = obj as unknown as TransactionWithDetails

  const tagResult = db.exec(
    'SELECT t.name FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id WHERE tt.transaction_id = ?',
    [id],
  )
  tx.tags = tagResult.length > 0
    ? tagResult[0]!.values.map((r) => r[0] as string)
    : []

  return tx
}

export interface InsertTransactionData {
  type: TransactionType
  source_income_id?: number | null
  source_budget_id?: number | null
  destination_budget_id?: number | null
  destination_spending_type_id?: number | null
  amount: number
  source_currency: string
  converted_amount?: number | null
  destination_currency?: string | null
  exchange_rate?: number | null
  date: string
  comment?: string
  tag_ids?: number[]
}

export function insertTransaction(db: Database, data: InsertTransactionData): number {
  db.run(
    `INSERT INTO transactions (
      type, source_income_id, source_budget_id,
      destination_budget_id, destination_spending_type_id,
      amount, source_currency, converted_amount, destination_currency, exchange_rate,
      date, comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.type,
      data.source_income_id ?? null,
      data.source_budget_id ?? null,
      data.destination_budget_id ?? null,
      data.destination_spending_type_id ?? null,
      Math.round(data.amount * 100),
      data.source_currency,
      data.converted_amount != null ? Math.round(data.converted_amount * 100) : null,
      data.destination_currency ?? null,
      data.exchange_rate ?? null,
      data.date,
      data.comment ?? '',
    ],
  )

  const result = db.exec('SELECT last_insert_rowid()')
  const txId = result[0]!.values[0]![0] as number

  if (data.tag_ids && data.tag_ids.length > 0) {
    for (const tagId of data.tag_ids) {
      db.run('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [txId, tagId])
    }
  }

  return txId
}

export function updateTransaction(db: Database, id: number, data: InsertTransactionData): void {
  db.run(
    `UPDATE transactions SET
      type = ?, source_income_id = ?, source_budget_id = ?,
      destination_budget_id = ?, destination_spending_type_id = ?,
      amount = ?, source_currency = ?, converted_amount = ?, destination_currency = ?, exchange_rate = ?,
      date = ?, comment = ?, updated_at = datetime('now')
    WHERE id = ?`,
    [
      data.type,
      data.source_income_id ?? null,
      data.source_budget_id ?? null,
      data.destination_budget_id ?? null,
      data.destination_spending_type_id ?? null,
      Math.round(data.amount * 100),
      data.source_currency,
      data.converted_amount != null ? Math.round(data.converted_amount * 100) : null,
      data.destination_currency ?? null,
      data.exchange_rate ?? null,
      data.date,
      data.comment ?? '',
      id,
    ],
  )

  // Replace tags
  db.run('DELETE FROM transaction_tags WHERE transaction_id = ?', [id])
  if (data.tag_ids && data.tag_ids.length > 0) {
    for (const tagId of data.tag_ids) {
      db.run('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [id, tagId])
    }
  }
}

export function deleteTransaction(db: Database, id: number): void {
  db.run('DELETE FROM transaction_tags WHERE transaction_id = ?', [id])
  db.run('DELETE FROM transactions WHERE id = ?', [id])
}

export function getTransactionsForEntity(
  db: Database,
  entityType: 'budget' | 'spending_type',
  entityId: number,
): TransactionWithDetails[] {
  const condition = entityType === 'budget'
    ? '(t.source_budget_id = ? OR t.destination_budget_id = ?)'
    : 't.destination_spending_type_id = ?'
  const params = entityType === 'budget' ? [entityId, entityId] : [entityId]

  const sql = `
    SELECT t.*,
      COALESCE(i.name, sb.name) as source_name,
      COALESCE(db2.name, st.name) as destination_name
    FROM transactions t
    LEFT JOIN incomes i ON t.source_income_id = i.id
    LEFT JOIN budgets sb ON t.source_budget_id = sb.id
    LEFT JOIN budgets db2 ON t.destination_budget_id = db2.id
    LEFT JOIN spending_types st ON t.destination_spending_type_id = st.id
    WHERE ${condition}
    ORDER BY t.date DESC, t.created_at DESC
  `

  const result = db.exec(sql, params)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as unknown as TransactionWithDetails
  })
}

export function getTransactionCount(db: Database): number {
  const result = db.exec('SELECT COUNT(*) FROM transactions')
  return result[0]!.values[0]![0] as number
}
