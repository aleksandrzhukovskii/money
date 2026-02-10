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
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Settings, Check, ChevronsUpDown, X } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
      {children}
    </div>
  )
}

function MultiSelectCombobox({
  label,
  placeholder,
  items,
  selected,
  onToggle,
}: {
  label: string
  placeholder: string
  items: { id: number; name: string }[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  if (items.length === 0) return null
  const selectedItems = items.filter((i) => selected.includes(i.id))
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between font-normal w-full">
            <span className="truncate text-sm">
              {selected.length === 0 ? placeholder : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
            <CommandList>
              {items
                .filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))
                .map((item) => (
                  <CommandItem key={item.id} value={item.name} onSelect={() => onToggle(item.id)}>
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selected.includes(item.id) ? 'opacity-100' : 'opacity-0'}`} />
                    {item.name}
                  </CommandItem>
                ))}
              {items.length > 0 && items.every((i) => !i.name.toLowerCase().includes((search.trim() || '').toLowerCase())) && (
                <CommandEmpty>No matches</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map((item) => (
            <Badge key={item.id} variant="default" className="cursor-pointer select-none text-xs">
              {item.name}
              <X className="h-3 w-3 ml-1" onClick={() => onToggle(item.id)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function StatisticsPage() {
  const { db, persistDebounced } = useDatabase()
  const [ratesReady, setRatesReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSpendingTypes, setSelectedSpendingTypes] = useState<number[]>([])
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)

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
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Statistics</h1>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dateRangeSelector}
          <p className="text-muted-foreground">
            {!ratesReady ? 'Loading exchange rates...' : preset === 'custom' ? 'Select a date range.' : 'Loading...'}
          </p>
        </div>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Statistics</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
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
          <MultiSelectCombobox
            label="Spending Types"
            placeholder="All spending types"
            items={spendingTypes}
            selected={selectedSpendingTypes}
            onToggle={toggleSpendingType}
          />
          <MultiSelectCombobox
            label="Tags"
            placeholder="All tags"
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
        <CurrencyBreakdown data={data.currencyHoldings} displayCurrency={data.displayCurrency} />
      </Section>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
