import { useState, useEffect, useCallback } from 'react'
import { useDatabase } from './useDatabase'
import { getExchangeRate, upsertExchangeRate, getActiveUserCurrencies } from '@/db/queries/exchangeRates'

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'
const FALLBACK_BASE = 'https://latest.currency-api.pages.dev/v1/currencies'

export function useExchangeRate(fromCurrency: string, toCurrency: string) {
  const { db, persistDebounced } = useDatabase()
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [isStale, setIsStale] = useState(false)

  const from = fromCurrency.toLowerCase()
  const to = toCurrency.toLowerCase()
  const isSameCurrency = fromCurrency === toCurrency
  const isValid = fromCurrency && toCurrency && !isSameCurrency

  const fetchRate = useCallback(async () => {
    if (!db || !isValid) return

    setLoading(true)
    setIsStale(false)

    let fetchedRate: number | null = null

    try {
      let data: Record<string, Record<string, number>> | null = null
      try {
        const res = await fetch(`${CDN_BASE}/${from}.json`)
        if (res.ok) data = await res.json()
      } catch { /* CDN failed */ }

      if (!data) {
        const res = await fetch(`${FALLBACK_BASE}/${from}.json`)
        if (res.ok) data = await res.json()
      }

      if (data?.[from]?.[to]) {
        fetchedRate = data[from][to]
        const today = new Date().toISOString().slice(0, 10)
        upsertExchangeRate(db, {
          base_currency: fromCurrency,
          target_currency: toCurrency,
          rate: fetchedRate,
          date: today,
        })
        // Also save rates for all active currencies from this response
        const activeCurrencies = getActiveUserCurrencies(db)
        const ratesObj = data[from]
        if (ratesObj) {
          for (const cur of activeCurrencies) {
            const lc = cur.toLowerCase()
            if (lc !== from && ratesObj[lc] != null && ratesObj[lc] > 0) {
              upsertExchangeRate(db, {
                base_currency: fromCurrency,
                target_currency: cur,
                rate: ratesObj[lc],
                date: today,
              })
            }
          }
        }
        persistDebounced()
      }
    } catch { /* fetch failed entirely */ }

    if (fetchedRate !== null) {
      setRate(fetchedRate)
    } else {
      // Fall back to cached rate
      const cached = getExchangeRate(db, fromCurrency, toCurrency)
      if (cached !== null) {
        setRate(cached)
        setIsStale(true)
      }
    }

    setLoading(false)
  }, [db, from, to, fromCurrency, toCurrency, isValid, persistDebounced])

  useEffect(() => {
    if (!isValid) {
      setRate(null)
      setLoading(false)
      setIsStale(false)
      return
    }
    fetchRate()
  }, [isValid, fetchRate])

  return { rate, loading, isStale }
}
