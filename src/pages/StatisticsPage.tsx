import { useStatistics } from '@/hooks/useStatistics'
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
  const { data, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo } = useStatistics()

  if (!data) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Statistics</h1>
          <DateRangeSelector
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </div>
        <p className="text-muted-foreground">
          {preset === 'custom' ? 'Select a date range above.' : 'Loading...'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <DateRangeSelector
          preset={preset}
          onPresetChange={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

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
  )
}
