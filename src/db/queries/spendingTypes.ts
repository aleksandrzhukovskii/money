import type { Database } from 'sql.js'
import type { SpendingType } from '@/types/database'

function rowToSpendingType(columns: string[], values: (string | number | null)[]): SpendingType {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj as unknown as SpendingType
}

export function getSpendingTypes(db: Database, activeOnly = true): SpendingType[] {
  const sql = activeOnly
    ? 'SELECT * FROM spending_types WHERE is_active = 1 ORDER BY sort_order, name'
    : 'SELECT * FROM spending_types ORDER BY sort_order, name'
  const result = db.exec(sql)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => rowToSpendingType(columns, row as (string | number | null)[]))
}

export function getSpendingTypeById(db: Database, id: number): SpendingType | null {
  const result = db.exec('SELECT * FROM spending_types WHERE id = ?', [id])
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return rowToSpendingType(result[0]!.columns, result[0]!.values[0] as (string | number | null)[])
}

export function insertSpendingType(
  db: Database,
  data: { name: string; currency: string; icon?: string; color?: string },
): number {
  db.run(
    'INSERT INTO spending_types (name, currency, icon, color) VALUES (?, ?, ?, ?)',
    [data.name, data.currency, data.icon ?? 'receipt', data.color ?? '#ef4444'],
  )
  const result = db.exec('SELECT last_insert_rowid()')
  return result[0]!.values[0]![0] as number
}

export function updateSpendingType(
  db: Database,
  id: number,
  data: Partial<Pick<SpendingType, 'name' | 'currency' | 'icon' | 'color' | 'is_active' | 'sort_order'>>,
): void {
  const fields: string[] = []
  const values: (string | number | null)[] = []
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(val as string | number | null)
    }
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now')")
  values.push(id)
  db.run(`UPDATE spending_types SET ${fields.join(', ')} WHERE id = ?`, values)
}

export function deleteSpendingType(db: Database, id: number): void {
  db.run('UPDATE spending_types SET is_active = 0 WHERE id = ?', [id])
}

/** Merge source spending type into target: tag affected txs, reassign, deactivate source */
export function mergeSpendingType(db: Database, sourceId: number, targetId: number): void {
  const source = getSpendingTypeById(db, sourceId)
  if (!source) return

  const txResult = db.exec(
    'SELECT id FROM transactions WHERE destination_spending_type_id = ?',
    [sourceId],
  )
  const txIds = txResult.length > 0 ? txResult[0]!.values.map(r => r[0] as number) : []

  if (txIds.length > 0) {
    db.run("INSERT OR IGNORE INTO tags (name, color) VALUES (?, '#9ca3af')", [source.name])
    const tagResult = db.exec('SELECT id FROM tags WHERE name = ?', [source.name])
    const tagId = tagResult[0]!.values[0]![0] as number

    for (const txId of txIds) {
      db.run('INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [txId, tagId])
    }
  }

  db.run('UPDATE transactions SET destination_spending_type_id = ? WHERE destination_spending_type_id = ?', [targetId, sourceId])
  db.run('UPDATE spending_types SET is_active = 0 WHERE id = ?', [sourceId])
}

/** Change a spending type's currency and recalculate all transaction amounts */
export function changeSpendingTypeCurrency(db: Database, id: number, newCurrency: string): void {
  // Get all transactions for this spending type
  const txResult = db.exec(
    'SELECT id, amount, source_currency FROM transactions WHERE destination_spending_type_id = ?',
    [id],
  )
  if (txResult.length > 0) {
    for (const row of txResult[0]!.values) {
      const txId = row[0] as number
      const amount = row[1] as number
      const srcCurrency = row[2] as string

      if (srcCurrency === newCurrency) {
        // Same currency now — clear cross-currency fields
        db.run(
          `UPDATE transactions SET destination_currency = NULL, converted_amount = NULL, exchange_rate = NULL WHERE id = ?`,
          [txId],
        )
      } else {
        // Look up rate: direct, then indirect via USD, fallback 1
        let rate = 1
        const directResult = db.exec(
          `SELECT rate FROM exchange_rates WHERE base_currency = ? AND target_currency = ? ORDER BY "date" DESC LIMIT 1`,
          [srcCurrency, newCurrency],
        )
        if (directResult.length > 0 && directResult[0]!.values.length > 0) {
          rate = directResult[0]!.values[0]![0] as number
        } else {
          // Indirect via USD
          const leg1 = db.exec(
            `SELECT rate FROM exchange_rates WHERE base_currency = ? AND target_currency = 'USD' ORDER BY "date" DESC LIMIT 1`,
            [srcCurrency],
          )
          const leg2 = db.exec(
            `SELECT rate FROM exchange_rates WHERE base_currency = 'USD' AND target_currency = ? ORDER BY "date" DESC LIMIT 1`,
            [newCurrency],
          )
          if (leg1.length > 0 && leg1[0]!.values.length > 0 && leg2.length > 0 && leg2[0]!.values.length > 0) {
            rate = (leg1[0]!.values[0]![0] as number) * (leg2[0]!.values[0]![0] as number)
          }
        }

        const convertedAmount = Math.round(amount * rate)
        db.run(
          `UPDATE transactions SET destination_currency = ?, converted_amount = ?, exchange_rate = ? WHERE id = ?`,
          [newCurrency, convertedAmount, rate, txId],
        )
      }
    }
  }

  // Update the spending type's currency
  db.run("UPDATE spending_types SET currency = ?, updated_at = datetime('now') WHERE id = ?", [newCurrency, id])
}

/** Returns a map of spending_type_id → total spent amount (cents) for the current month */
export function getMonthlySpending(db: Database): Record<number, number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const result = db.exec(
    `SELECT destination_spending_type_id, SUM(COALESCE(converted_amount, amount)) as total
     FROM transactions
     WHERE type = 'spending' AND destination_spending_type_id IS NOT NULL AND date >= ?
     GROUP BY destination_spending_type_id`,
    [monthStart],
  )
  const map: Record<number, number> = {}
  if (result.length > 0) {
    for (const row of result[0]!.values) {
      map[row[0] as number] = row[1] as number
    }
  }
  return map
}
