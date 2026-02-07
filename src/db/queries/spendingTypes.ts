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

/** Returns a map of spending_type_id → total spent amount (cents) for the current month */
export function getMonthlySpending(db: Database): Record<number, number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const result = db.exec(
    `SELECT destination_spending_type_id, SUM(amount) as total
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
