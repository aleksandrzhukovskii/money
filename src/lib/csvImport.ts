import type { Database } from 'sql.js'

export interface CsvRow {
  date: string          // YYYY-MM-DD
  type: 'earning' | 'spending' | 'transfer'
  from: string
  to: string
  tags: string[]
  amount: number        // display value (not cents)
  currency: string
  convertedAmount: number
  convertedCurrency: string
  comment: string
}

export interface EntityDef {
  name: string
  currency: string
  type: 'income' | 'budget' | 'spending'
}

export interface ParseResult {
  rows: CsvRow[]
  entities: EntityDef[]
  tags: string[]
}

/** Parse a single CSV line respecting double-quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

/** Convert MM/DD/YYYY to YYYY-MM-DD */
function convertDate(raw: string): string {
  const parts = raw.split('/')
  if (parts.length !== 3) return raw
  const [month, day, year] = parts
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  // Handle comma as decimal separator
  const cleaned = raw.replace(/,/g, '.')
  return parseFloat(cleaned) || 0
}

export function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return { rows: [], entities: [], tags: [] }
  }

  // Skip header line
  const dataLines = lines.slice(1)

  const rows: CsvRow[] = []
  const fromEntities = new Map<string, string>() // name → currency
  const toEntities = new Map<string, string>()
  const expenseTos = new Set<string>()
  const allFroms = new Set<string>()
  const allTos = new Set<string>()
  const tagSet = new Set<string>()

  for (const line of dataLines) {
    const fields = parseCsvLine(line)
    if (fields.length < 10) continue

    const [dateRaw, typeRaw, from, to, tagRaw, amountRaw, currency, convertedRaw, convertedCurrency] = fields
    const comment = fields[10] ?? ''

    const csvType = (typeRaw ?? '').trim()
    const fromName = (from ?? '').trim()
    const toName = (to ?? '').trim()
    const tagRawStr = (tagRaw ?? '').trim()
    const cur = (currency ?? '').trim()
    const convCur = (convertedCurrency ?? '').trim()

    if (!fromName || !toName) continue

    // Split comma-separated tags
    const rowTags = tagRawStr
      ? tagRawStr.split(',').map(t => t.trim()).filter(Boolean)
      : []

    // Determine transaction type
    let txType: 'earning' | 'spending' | 'transfer'
    if (csvType === 'Expense') {
      txType = 'spending'
      expenseTos.add(toName)
    } else {
      // Transfer — actual tx type determined after classification
      txType = 'transfer'
    }

    allFroms.add(fromName)
    allTos.add(toName)

    // Track currencies: From gets source currency, To gets converted currency (or source if same)
    if (cur && !fromEntities.has(fromName)) {
      fromEntities.set(fromName, cur)
    }
    const toCurrency = convCur || cur
    if (toCurrency && !toEntities.has(toName)) {
      toEntities.set(toName, toCurrency)
    }

    for (const t of rowTags) tagSet.add(t)

    rows.push({
      date: convertDate((dateRaw ?? '').trim()),
      type: txType,
      from: fromName,
      to: toName,
      tags: rowTags,
      amount: parseAmount((amountRaw ?? '').trim()),
      currency: cur,
      convertedAmount: parseAmount((convertedRaw ?? '').trim()),
      convertedCurrency: convCur,
      comment: comment.trim(),
    })
  }

  // Classify entities
  const entityMap = new Map<string, EntityDef>()

  // All unique entity names
  const allNames = new Set([...allFroms, ...allTos])

  for (const name of allNames) {
    let type: 'income' | 'budget' | 'spending'

    if (expenseTos.has(name)) {
      // Appeared as To in an Expense row → spending
      type = 'spending'
    } else if (allFroms.has(name) && !allTos.has(name)) {
      // Only appears as From, never as To → income
      type = 'income'
    } else {
      // Everything else → budget
      type = 'budget'
    }

    // Currency: prefer from-side, fall back to to-side
    const currency = fromEntities.get(name) || toEntities.get(name) || 'USD'

    entityMap.set(name, { name, currency, type })
  }

  // Now fix tx types for Transfer rows based on entity classification
  for (const row of rows) {
    if (row.type !== 'spending') {
      const fromEntity = entityMap.get(row.from)
      if (fromEntity?.type === 'income') {
        row.type = 'earning'
      } else {
        row.type = 'transfer'
      }
    }
  }

  const entities = Array.from(entityMap.values()).sort((a, b) => {
    const order = { income: 0, budget: 1, spending: 2 }
    return order[a.type] - order[b.type] || a.name.localeCompare(b.name)
  })

  const tags = Array.from(tagSet).sort()

  return { rows, entities, tags }
}

export function executeCsvImport(
  db: Database,
  rows: CsvRow[],
  entities: EntityDef[],
  tags: string[],
): void {
  // Clear existing data (order matters for FK constraints)
  db.run('DELETE FROM transaction_tags')
  db.run('DELETE FROM transactions')
  db.run('DELETE FROM incomes')
  db.run('DELETE FROM budgets')
  db.run('DELETE FROM spending_types')
  db.run('DELETE FROM tags')

  // Insert entities and build name→id maps
  const incomeIds = new Map<string, number>()
  const budgetIds = new Map<string, number>()
  const spendingIds = new Map<string, number>()

  for (const entity of entities) {
    if (entity.type === 'income') {
      db.run(
        'INSERT INTO incomes (name, currency, expected_amount, icon, color) VALUES (?, ?, 0, ?, ?)',
        [entity.name, entity.currency, 'wallet', '#10b981'],
      )
      const id = (db.exec('SELECT last_insert_rowid()')[0]!.values[0]![0] as number)
      incomeIds.set(entity.name, id)
    } else if (entity.type === 'budget') {
      db.run(
        'INSERT INTO budgets (name, currency, initial_balance, icon, color) VALUES (?, ?, 0, ?, ?)',
        [entity.name, entity.currency, 'piggy-bank', '#3b82f6'],
      )
      const id = (db.exec('SELECT last_insert_rowid()')[0]!.values[0]![0] as number)
      budgetIds.set(entity.name, id)
    } else {
      db.run(
        'INSERT INTO spending_types (name, currency, icon, color) VALUES (?, ?, ?, ?)',
        [entity.name, entity.currency, 'receipt', '#ef4444'],
      )
      const id = (db.exec('SELECT last_insert_rowid()')[0]!.values[0]![0] as number)
      spendingIds.set(entity.name, id)
    }
  }

  // Insert tags and build name→id map
  const tagIds = new Map<string, number>()
  for (const tagName of tags) {
    db.run('INSERT INTO tags (name) VALUES (?)', [tagName])
    const id = (db.exec('SELECT last_insert_rowid()')[0]!.values[0]![0] as number)
    tagIds.set(tagName, id)
  }

  // Insert transactions
  for (const row of rows) {
    let sourceIncomeId: number | null = null
    let sourceBudgetId: number | null = null
    let destBudgetId: number | null = null
    let destSpendingId: number | null = null

    const fromEntity = entities.find(e => e.name === row.from)
    const toEntity = entities.find(e => e.name === row.to)

    if (fromEntity?.type === 'income') {
      sourceIncomeId = incomeIds.get(row.from) ?? null
    } else if (fromEntity?.type === 'budget') {
      sourceBudgetId = budgetIds.get(row.from) ?? null
    }

    if (toEntity?.type === 'budget') {
      destBudgetId = budgetIds.get(row.to) ?? null
    } else if (toEntity?.type === 'spending') {
      destSpendingId = spendingIds.get(row.to) ?? null
    }

    // Determine actual tx type based on entity classifications
    let txType: string = row.type
    if (fromEntity?.type === 'income') {
      txType = 'earning'
    } else if (toEntity?.type === 'spending') {
      txType = 'spending'
    } else {
      txType = 'transfer'
    }

    // Amounts: store as cents (×100)
    const amountCents = Math.round(row.amount * 100)
    const sourceCurrency = row.currency

    // Cross-currency handling
    const isCross = row.convertedCurrency && row.convertedCurrency !== row.currency
    const convertedCents = isCross ? Math.round(row.convertedAmount * 100) : null
    const destCurrency = isCross ? row.convertedCurrency : null
    const exchangeRate = isCross && row.amount !== 0
      ? row.convertedAmount / row.amount
      : null

    db.run(
      `INSERT INTO transactions (
        type, source_income_id, source_budget_id,
        destination_budget_id, destination_spending_type_id,
        amount, source_currency, converted_amount, destination_currency, exchange_rate,
        date, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txType,
        sourceIncomeId,
        sourceBudgetId,
        destBudgetId,
        destSpendingId,
        amountCents,
        sourceCurrency,
        convertedCents,
        destCurrency,
        exchangeRate,
        row.date,
        row.comment,
      ],
    )

    // Link tags
    if (row.tags.length > 0) {
      const txId = db.exec('SELECT last_insert_rowid()')[0]!.values[0]![0] as number
      for (const tagName of row.tags) {
        const tagId = tagIds.get(tagName)
        if (tagId != null) {
          db.run('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)', [txId, tagId])
        }
      }
    }
  }
}
