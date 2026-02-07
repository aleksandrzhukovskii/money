import type { Database } from 'sql.js'

export function getSetting(db: Database, key: string): string | null {
  const result = db.exec('SELECT value FROM settings WHERE key = ?', [key])
  if (result.length === 0 || result[0]!.values.length === 0) return null
  return result[0]!.values[0]![0] as string
}

export function setSetting(db: Database, key: string, value: string): void {
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, value, value],
  )
}

export function deleteSetting(db: Database, key: string): void {
  db.run('DELETE FROM settings WHERE key = ?', [key])
}
