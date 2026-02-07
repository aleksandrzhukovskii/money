-- Schema versioning
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO schema_version (version) VALUES (5);

-- Cached currency list from exchange API
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- Income sources
CREATE TABLE IF NOT EXISTS incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  expected_amount INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'wallet',
  color TEXT DEFAULT '#10b981',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgets / Pockets
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  icon TEXT DEFAULT 'piggy-bank',
  color TEXT DEFAULT '#3b82f6',
  initial_balance INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Spending types / categories
CREATE TABLE IF NOT EXISTS spending_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  icon TEXT DEFAULT 'receipt',
  color TEXT DEFAULT '#ef4444',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#8b5cf6',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unified transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('earning', 'spending', 'transfer')),
  source_income_id INTEGER,
  source_budget_id INTEGER,
  destination_budget_id INTEGER,
  destination_spending_type_id INTEGER,
  amount INTEGER NOT NULL,
  source_currency TEXT NOT NULL,
  converted_amount INTEGER,
  destination_currency TEXT,
  exchange_rate REAL,
  date TEXT NOT NULL,
  comment TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (type = 'earning'  AND source_income_id IS NOT NULL AND source_budget_id IS NULL
     AND destination_budget_id IS NOT NULL AND destination_spending_type_id IS NULL)
    OR
    (type = 'spending' AND source_income_id IS NULL AND source_budget_id IS NOT NULL
     AND destination_budget_id IS NULL AND destination_spending_type_id IS NOT NULL)
    OR
    (type = 'transfer' AND source_income_id IS NULL AND source_budget_id IS NOT NULL
     AND destination_budget_id IS NOT NULL AND destination_spending_type_id IS NULL)
  ),
  FOREIGN KEY (source_income_id) REFERENCES incomes(id),
  FOREIGN KEY (source_budget_id) REFERENCES budgets(id),
  FOREIGN KEY (destination_budget_id) REFERENCES budgets(id),
  FOREIGN KEY (destination_spending_type_id) REFERENCES spending_types(id)
);

-- Transaction tags junction
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Cached exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(base_currency, target_currency, date)
);

-- Key-value settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_source_budget ON transactions(source_budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dest_budget ON transactions(destination_budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dest_spending ON transactions(destination_spending_type_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source_income ON transactions(source_income_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date ON exchange_rates(base_currency, target_currency, date);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incomes_name_active ON incomes(name) WHERE is_active = 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_name_active ON budgets(name) WHERE is_active = 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_spending_types_name_active ON spending_types(name) WHERE is_active = 1;
