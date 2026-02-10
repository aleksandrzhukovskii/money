import { useEffect, useState } from 'react'
import { useStatistics } from '@/hooks/useStatistics'
import { useDatabase } from '@/hooks/useDatabase'
import { refreshExchangeRates } from '@/lib/exchangeRateSync'
import { DateRangeSelector } from '@/components/stats/DateRangeSelector'
import { SummaryCards } from '@/components/stats/SummaryCards'
import { SpendingByCategory } from '@/components/stats/SpendingByCategory'
import { IncomeVsExpense } from '@/components/stats/IncomeVsExpense'
import { MonthlyTrend } from '@/components/stats/MonthlyTrend'
import { BudgetBalanceTrend } from '@/components/stats/BudgetBalanceTrend'
import { TagCloud } from '@/components/stats/TagCloud'
import { CurrencyBreakdown } from '@/components/stats/CurrencyBreakdown'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      {children}
    </div>
  )
}

export function StatisticsPage() {
  const { db, persistDebounced } = useDatabase()
  const [ratesReady, setRatesReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Ensure fresh exchange rates before computing stats
  useEffect(() => {
    if (!db) return
    let cancelled = false
    refreshExchangeRates(db, persistDebounced)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setRatesReady(true)
          setRefreshKey((k) => k + 1)
        }
      })
    return () => { cancelled = true }
  }, [db, persistDebounced])

  const { data, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo } = useStatistics(refreshKey)

  const dateRangeSelector = (
    <DateRangeSelector
      preset={preset}
      onPresetChange={setPreset}
      customFrom={customFrom}
      customTo={customTo}
      onCustomFromChange={setCustomFrom}
      onCustomToChange={setCustomTo}
    />
  )

  if (!ratesReady || !data) {
    return (
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
          <h1 className="text-xl font-bold">Statistics</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dateRangeSelector}
          <p className="text-muted-foreground">
            {!ratesReady ? 'Loading exchange rates...' : preset === 'custom' ? 'Select a date range.' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold">Statistics</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {dateRangeSelector}
      <SummaryCards
        current={data.currentSummary}
        previous={data.previousSummary}
        displayCurrency={data.displayCurrency}
      />

      <Section title="Spending by Category">
        <SpendingByCategory data={data.spendingByCategory} />
      </Section>

      <Section title="Income vs Expenses">
        <IncomeVsExpense data={data.monthlyTotals} />
      </Section>

      <Section title="Monthly Spending Trend">
        <MonthlyTrend data={data.monthlyTotals} />
      </Section>

      <Section title="Budget Balance Trend">
        <BudgetBalanceTrend data={data.budgetBalanceTrend} />
      </Section>

      <Section title="Tag Distribution">
        <TagCloud data={data.tagDistribution} />
      </Section>

      <Section title="Currency Breakdown">
        <CurrencyBreakdown data={data.currencyHoldings} />
      </Section>
      </div>
    </div>
  )
}
