import { useEffect, useMemo, useState } from 'react'
import { useStatistics } from '@/hooks/useStatistics'
import { useDatabase } from '@/hooks/useDatabase'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { refreshExchangeRates } from '@/lib/exchangeRateSync'
import { getFilteredMonthlyExpenses } from '@/db/queries/statistics'
import { DateRangeSelector } from '@/components/stats/DateRangeSelector'
import { SummaryCards } from '@/components/stats/SummaryCards'
import { SpendingByCategory } from '@/components/stats/SpendingByCategory'
import { IncomeVsExpense } from '@/components/stats/IncomeVsExpense'
import { ExpenseBreakdown } from '@/components/stats/ExpenseBreakdown'
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

function FilterPills({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string
  items: { id: number; name: string }[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const active = selected.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StatisticsPage() {
  const { db, persistDebounced } = useDatabase()
  const [ratesReady, setRatesReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSpendingTypes, setSelectedSpendingTypes] = useState<number[]>([])
  const [selectedTags, setSelectedTags] = useState<number[]>([])

  const spendingTypes = useSpendingTypesStore((s) => s.items)
  const tags = useTagsStore((s) => s.items)

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

  const filteredExpenses = useMemo(() => {
    if (!db || !data) return []
    return getFilteredMonthlyExpenses(
      db,
      data.dateFrom,
      data.dateTo,
      data.displayCurrency,
      selectedTags.length > 0 ? selectedTags : undefined,
      selectedSpendingTypes.length > 0 ? selectedSpendingTypes : undefined,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, data?.dateFrom, data?.dateTo, data?.displayCurrency, selectedTags, selectedSpendingTypes, refreshKey])

  function toggleSpendingType(id: number) {
    setSelectedSpendingTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

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

      <Section title="Expense Breakdown">
        <div className="space-y-3 mb-2">
          <FilterPills
            label="Spending Types"
            items={spendingTypes}
            selected={selectedSpendingTypes}
            onToggle={toggleSpendingType}
          />
          <FilterPills
            label="Tags"
            items={tags}
            selected={selectedTags}
            onToggle={toggleTag}
          />
        </div>
        <ExpenseBreakdown data={filteredExpenses} />
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
