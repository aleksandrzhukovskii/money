import { useMemo, useState } from 'react'
import { useDatabase } from './useDatabase'
import { getSetting } from '@/db/queries/settings'
import {
  getSpendingByCategory,
  getMonthlyTotals,
  getPeriodSummary,
  getTagDistribution,
  getCurrencyHoldings,
  getBudgetBalanceTrend,
} from '@/db/queries/statistics'

export type DateRangePreset =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-12-months'
  | 'all-time'
  | 'custom'

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getDateBounds(preset: DateRangePreset): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'this-month':
      return { dateFrom: `${formatMonth(now)}-01`, dateTo: `${formatMonth(now)}-31` }
    case 'last-month': {
      const d = new Date(y, m - 1, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(d)}-31` }
    }
    case 'last-3-months': {
      const d = new Date(y, m - 2, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(now)}-31` }
    }
    case 'last-6-months': {
      const d = new Date(y, m - 5, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(now)}-31` }
    }
    case 'last-12-months': {
      const d = new Date(y, m - 11, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(now)}-31` }
    }
    case 'all-time':
    case 'custom':
      return { dateFrom: '2000-01-01', dateTo: '2099-12-31' }
  }
}

function getPreviousPeriodBounds(preset: DateRangePreset): { dateFrom: string; dateTo: string } {
  if (preset === 'custom' || preset === 'all-time') {
    return { dateFrom: '1900-01-01', dateTo: '1999-12-31' }
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'this-month': {
      const d = new Date(y, m - 1, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(d)}-31` }
    }
    case 'last-month': {
      const d = new Date(y, m - 2, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(d)}-31` }
    }
    case 'last-3-months': {
      const d = new Date(y, m - 5, 1)
      const e = new Date(y, m - 3, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(e)}-31` }
    }
    case 'last-6-months': {
      const d = new Date(y, m - 11, 1)
      const e = new Date(y, m - 6, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(e)}-31` }
    }
    case 'last-12-months': {
      const d = new Date(y, m - 23, 1)
      const e = new Date(y, m - 12, 1)
      return { dateFrom: `${formatMonth(d)}-01`, dateTo: `${formatMonth(e)}-31` }
    }
  }
}

export function useStatistics() {
  const { db } = useDatabase()
  const [preset, setPreset] = useState<DateRangePreset>('this-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const data = useMemo(() => {
    if (!db) return null

    let dateFrom: string
    let dateTo: string

    if (preset === 'custom' && customFrom && customTo) {
      dateFrom = customFrom
      dateTo = customTo
    } else if (preset === 'custom') {
      return null
    } else {
      const bounds = getDateBounds(preset)
      dateFrom = bounds.dateFrom
      dateTo = bounds.dateTo
    }

    const prev = getPreviousPeriodBounds(preset)

    return {
      spendingByCategory: getSpendingByCategory(db, dateFrom, dateTo),
      monthlyTotals: getMonthlyTotals(db, dateFrom, dateTo),
      currentSummary: getPeriodSummary(db, dateFrom, dateTo),
      previousSummary: getPeriodSummary(db, prev.dateFrom, prev.dateTo),
      tagDistribution: getTagDistribution(db, dateFrom, dateTo),
      currencyHoldings: getCurrencyHoldings(db),
      budgetBalanceTrend: getBudgetBalanceTrend(db, dateFrom, dateTo),
      displayCurrency: getSetting(db, 'display_currency') ?? 'USD',
      dateFrom,
      dateTo,
    }
  }, [db, preset, customFrom, customTo])

  return { data, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }
}
