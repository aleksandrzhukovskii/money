import type { Database } from 'sql.js'

type Migration = (db: Database) => void

// Each key is the version TO migrate to.
// Version 1 is the initial schema (applied via schema.sql).
// Add future migrations here:
const migrations: Record<number, Migration> = {
  2: (db) => {
    db.run('ALTER TABLE incomes ADD COLUMN expected_amount REAL NOT NULL DEFAULT 0')
  },
  3: (db) => {
    // Convert monetary REAL columns to INTEGER (cents = amount * 100)
    db.run('UPDATE incomes SET expected_amount = CAST(ROUND(expected_amount * 100) AS INTEGER)')
    db.run('UPDATE budgets SET initial_balance = CAST(ROUND(initial_balance * 100) AS INTEGER)')
    db.run('UPDATE transactions SET amount = CAST(ROUND(amount * 100) AS INTEGER)')
    db.run('UPDATE transactions SET converted_amount = CAST(ROUND(converted_amount * 100) AS INTEGER) WHERE converted_amount IS NOT NULL')
  },
  4: (db) => {
    db.run(`CREATE TABLE spending_types_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      icon TEXT DEFAULT 'receipt',
      color TEXT DEFAULT '#ef4444',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    db.run(`INSERT INTO spending_types_new (id, name, currency, icon, color, is_active, sort_order, created_at, updated_at)
      SELECT id, name, currency, icon, color, is_active, sort_order, created_at, updated_at FROM spending_types`)
    db.run('DROP TABLE spending_types')
    db.run('ALTER TABLE spending_types_new RENAME TO spending_types')
  },
  5: (db) => {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_incomes_name_active ON incomes(name) WHERE is_active = 1')
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_name_active ON budgets(name) WHERE is_active = 1')
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_spending_types_name_active ON spending_types(name) WHERE is_active = 1')
  },
  6: (db) => {
    db.run("DELETE FROM settings WHERE key IN ('encryption_password', 'github_repo', 'github_token')")
  },
}

export function getSchemaVersion(db: Database): number {
  const result = db.exec('SELECT version FROM schema_version LIMIT 1')
  if (result.length === 0 || result[0]!.values.length === 0) return 0
  return result[0]!.values[0]![0] as number
}

export function runMigrations(db: Database): void {
  const currentVersion = getSchemaVersion(db)
  const versions = Object.keys(migrations)
    .map(Number)
    .filter((v) => v > currentVersion)
    .sort((a, b) => a - b)

  for (const version of versions) {
    migrations[version]!(db)
    db.run('UPDATE schema_version SET version = ?', [version])
  }
}
