import type { Database } from 'sql.js'
import type { Budget, BudgetWithBalance } from '@/types/database'

function rowToBudget(columns: string[], values: (string | number | null)[]): Budget {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj as unknown as Budget
}

export function getBudgets(db: Database, activeOnly = true): Budget[] {
  const sql = activeOnly
    ? 'SELECT * FROM budgets WHERE is_active = 1 ORDER BY sort_order, name'
    : 'SELECT * FROM budgets ORDER BY sort_order, name'
  const result = db.exec(sql)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => rowToBudget(columns, row as (string | number | null)[]))
}

export function getBudgetsWithBalances(db: Database, activeOnly = true): BudgetWithBalance[] {
  const whereClause = activeOnly ? 'WHERE b.is_active = 1' : ''
  const sql = `
    SELECT b.*,
      b.initial_balance
      + COALESCE((SELECT SUM(
          CASE WHEN t.destination_currency IS NOT NULL THEN t.converted_amount ELSE t.amount END
        ) FROM transactions t WHERE t.destination_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount)
        FROM transactions t WHERE t.source_budget_id = b.id), 0)
      AS current_balance
    FROM budgets b
    ${whereClause}
    ORDER BY b.sort_order, b.name
  `
  const result = db.exec(sql)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as unknown as BudgetWithBalance
  })
}

export function getBudgetById(db: Database, id: number): Budget | null {
  const result = db.exec('SELECT * FROM budgets WHERE id = ?', [id])
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return rowToBudget(result[0]!.columns, result[0]!.values[0] as (string | number | null)[])
}

export function insertBudget(
  db: Database,
  data: { name: string; currency: string; initial_balance?: number; icon?: string; color?: string },
): number {
  db.run(
    'INSERT INTO budgets (name, currency, initial_balance, icon, color) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.currency, Math.round((data.initial_balance ?? 0) * 100), data.icon ?? 'piggy-bank', data.color ?? '#3b82f6'],
  )
  const result = db.exec('SELECT last_insert_rowid()')
  return result[0]!.values[0]![0] as number
}

export function updateBudget(
  db: Database,
  id: number,
  data: Partial<Pick<Budget, 'name' | 'currency' | 'initial_balance' | 'icon' | 'color' | 'is_active' | 'sort_order'>>,
): void {
  const fields: string[] = []
  const values: (string | number)[] = []
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(key === 'initial_balance' ? Math.round((val as number) * 100) : val)
    }
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now')")
  values.push(id)
  db.run(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, values)
}

export function deleteBudget(db: Database, id: number): void {
  db.run('UPDATE budgets SET is_active = 0 WHERE id = ?', [id])
}
