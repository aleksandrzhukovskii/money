import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddIncomeDialog } from '@/components/main/AddIncomeDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { matchesFilter } from '@/lib/filter'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import type { Income } from '@/types/database'

export function IncomesPage() {
  const { db } = useDatabase()
  const { items, monthlyEarned, load } = useIncomesStore()
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (db) load(db)
  }, [db, load])

  function getProgress(income: Income): number | undefined {
    if (!income.expected_amount || income.expected_amount <= 0) return undefined
    const earned = monthlyEarned[income.id] ?? 0
    return earned / income.expected_amount
  }

  const filtered = items.filter(i => matchesFilter(i.name, filter))

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Incomes</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="p-4 space-y-4">
        <FilterInput value={filter} onChange={setFilter} />
        <div className="flex flex-wrap gap-3">
          {filtered.map((income) => (
            <EntityCard
              key={income.id}
              name={income.name}
              currency={income.currency}
              earned={monthlyEarned[income.id] ?? 0}
              expectedAmount={income.expected_amount}
              progress={getProgress(income)}
              onClick={() => { setEditing(income); setDialogOpen(true) }}
            />
          ))}
          <AddCard label="Add Income" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddIncomeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
