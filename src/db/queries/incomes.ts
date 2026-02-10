import type { Database } from 'sql.js'
import type { Income } from '@/types/database'

function rowToIncome(columns: string[], values: (string | number | null)[]): Income {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj as unknown as Income
}

export function getIncomes(db: Database, activeOnly = true): Income[] {
  const sql = activeOnly
    ? 'SELECT * FROM incomes WHERE is_active = 1 ORDER BY sort_order, name'
    : 'SELECT * FROM incomes ORDER BY sort_order, name'
  const result = db.exec(sql)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => rowToIncome(columns, row as (string | number | null)[]))
}

export function getIncomeById(db: Database, id: number): Income | null {
  const result = db.exec('SELECT * FROM incomes WHERE id = ?', [id])
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return rowToIncome(result[0]!.columns, result[0]!.values[0] as (string | number | null)[])
}

export function insertIncome(
  db: Database,
  data: { name: string; currency: string; expected_amount?: number; icon?: string; color?: string },
): number {
  db.run(
    'INSERT INTO incomes (name, currency, expected_amount, icon, color) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.currency, Math.round((data.expected_amount ?? 0) * 100), data.icon ?? 'wallet', data.color ?? '#10b981'],
  )
  const result = db.exec('SELECT last_insert_rowid()')
  return result[0]!.values[0]![0] as number
}

export function updateIncome(
  db: Database,
  id: number,
  data: Partial<Pick<Income, 'name' | 'currency' | 'expected_amount' | 'icon' | 'color' | 'is_active' | 'sort_order'>>,
): void {
  const fields: string[] = []
  const values: (string | number)[] = []
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(key === 'expected_amount' ? Math.round((val as number) * 100) : val)
    }
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now')")
  values.push(id)
  db.run(`UPDATE incomes SET ${fields.join(', ')} WHERE id = ?`, values)
}

export function deleteIncome(db: Database, id: number): void {
  db.run('UPDATE incomes SET is_active = 0 WHERE id = ?', [id])
}

/** Merge source income into target: tag affected txs, reassign, deactivate source */
export function mergeIncome(db: Database, sourceId: number, targetId: number): void {
  const source = getIncomeById(db, sourceId)
  if (!source) return

  // Get affected transaction IDs
  const txResult = db.exec('SELECT id FROM transactions WHERE source_income_id = ?', [sourceId])
  const txIds = txResult.length > 0 ? txResult[0]!.values.map(r => r[0] as number) : []

  if (txIds.length > 0) {
    // Create or find tag with source entity name
    db.run("INSERT OR IGNORE INTO tags (name, color) VALUES (?, '#9ca3af')", [source.name])
    const tagResult = db.exec('SELECT id FROM tags WHERE name = ?', [source.name])
    const tagId = tagResult[0]!.values[0]![0] as number

    // Tag all affected transactions
    for (const txId of txIds) {
      db.run('INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [txId, tagId])
    }
  }

  // Reassign and deactivate
  db.run('UPDATE transactions SET source_income_id = ? WHERE source_income_id = ?', [targetId, sourceId])
  db.run('UPDATE incomes SET is_active = 0 WHERE id = ?', [sourceId])
}

export function reorderIncomes(db: Database, orderedIds: number[]): void {
  orderedIds.forEach((id, i) => db.run('UPDATE incomes SET sort_order = ? WHERE id = ?', [i, id]))
}

/** Returns a map of income_id → total earned amount for the current month */
export function getMonthlyEarnings(db: Database): Record<number, number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const result = db.exec(
    `SELECT source_income_id, SUM(amount) as total
     FROM transactions
     WHERE type = 'earning' AND source_income_id IS NOT NULL AND date >= ?
     GROUP BY source_income_id`,
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
