import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useBudgetsStore } from '@/stores/budgets'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddBudgetDialog } from '@/components/main/AddBudgetDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { matchesFilter } from '@/lib/filter'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import type { Budget, BudgetWithBalance } from '@/types/database'

export function BudgetsPage() {
  const { db } = useDatabase()
  const { itemsWithBalances, load } = useBudgetsStore()
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (db) load(db)
  }, [db, load])

  const filtered = itemsWithBalances.filter(b => matchesFilter(b.name, filter))

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Budgets</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="p-4 space-y-4">
        <FilterInput value={filter} onChange={setFilter} />
        <div className="flex flex-wrap gap-3">
          {filtered.map((budget: BudgetWithBalance) => (
            <EntityCard
              key={budget.id}
              name={budget.name}
              currency={budget.currency}
              balance={budget.current_balance}
              onClick={() => { setEditing(budget); setDialogOpen(true) }}
            />
          ))}
          <AddCard label="Add Budget" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddBudgetDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
