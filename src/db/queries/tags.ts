import type { Database } from 'sql.js'
import type { Tag } from '@/types/database'

function rowToTag(columns: string[], values: (string | number | null)[]): Tag {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj as unknown as Tag
}

export function getTags(db: Database): Tag[] {
  const result = db.exec(`
    SELECT t.*
    FROM tags t
    LEFT JOIN transaction_tags tt ON tt.tag_id = t.id
    LEFT JOIN transactions tx ON tx.id = tt.transaction_id
    GROUP BY t.id
    ORDER BY MAX(tx.date) DESC NULLS LAST, t.name
  `)
  if (result.length === 0) return []
  const columns = result[0]!.columns
  return result[0]!.values.map((row) => rowToTag(columns, row as (string | number | null)[]))
}

export function getTagById(db: Database, id: number): Tag | null {
  const result = db.exec('SELECT * FROM tags WHERE id = ?', [id])
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return rowToTag(result[0]!.columns, result[0]!.values[0] as (string | number | null)[])
}

export function insertTag(db: Database, data: { name: string; color?: string }): number {
  db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [data.name, data.color ?? '#8b5cf6'])
  const result = db.exec('SELECT last_insert_rowid()')
  return result[0]!.values[0]![0] as number
}

export function updateTag(db: Database, id: number, data: Partial<Pick<Tag, 'name' | 'color'>>): void {
  const fields: string[] = []
  const values: (string | number)[] = []
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(val)
    }
  }
  if (fields.length === 0) return
  values.push(id)
  db.run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values)
}

export function deleteTag(db: Database, id: number): void {
  db.run('DELETE FROM transaction_tags WHERE tag_id = ?', [id])
  db.run('DELETE FROM tags WHERE id = ?', [id])
}
