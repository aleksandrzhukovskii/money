import { useState, useEffect, useCallback } from 'react'
import { useDatabase } from './useDatabase'
import type { Currency } from '@/types/database'

const CDN_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json'
const FALLBACK_URL = 'https://latest.currency-api.pages.dev/v1/currencies.json'

export function useCurrencies() {
  const { db, persistDebounced } = useDatabase()
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(false)

  const loadFromDb = useCallback(() => {
    if (!db) return
    const result = db.exec('SELECT code, name, fetched_at FROM currencies ORDER BY code')
    if (result.length > 0) {
      const items = result[0]!.values.map((row) => ({
        code: row[0] as string,
        name: row[1] as string,
        fetched_at: row[2] as string,
      }))
      setCurrencies(items)
      return items.length > 0
    }
    return false
  }, [db])

  const fetchAndCache = useCallback(async () => {
    if (!db) return
    setLoading(true)
    try {
      let data: Record<string, string> | null = null
      try {
        const res = await fetch(CDN_URL)
        if (res.ok) data = await res.json()
      } catch { /* CDN failed */ }

      if (!data) {
        const res = await fetch(FALLBACK_URL)
        if (res.ok) data = await res.json()
      }

      if (!data) return

      const now = new Date().toISOString()
      db.run('DELETE FROM currencies')
      for (const [code, name] of Object.entries(data)) {
        // Skip crypto/non-standard (only keep 2-3 letter codes)
        if (code.length > 3) continue
        db.run(
          'INSERT INTO currencies (code, name, fetched_at) VALUES (?, ?, ?)',
          [code.toUpperCase(), name, now],
        )
      }
      persistDebounced()
      loadFromDb()
    } finally {
      setLoading(false)
    }
  }, [db, persistDebounced, loadFromDb])

  useEffect(() => {
    if (!db) return
    const hasData = loadFromDb()
    if (!hasData) {
      fetchAndCache()
    }
  }, [db, loadFromDb, fetchAndCache])

  return { currencies, loading, refresh: fetchAndCache }
}
