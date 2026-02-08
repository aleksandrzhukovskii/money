import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddSpendingTypeDialog } from '@/components/main/AddSpendingTypeDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { matchesFilter } from '@/lib/filter'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import type { SpendingType } from '@/types/database'

export function SpendingsPage() {
  const { db } = useDatabase()
  const { items, monthlySpent, load } = useSpendingTypesStore()
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SpendingType | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (db) load(db)
  }, [db, load])

  const filtered = items.filter(i => matchesFilter(i.name, filter))

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Spendings</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="p-4 space-y-4">
        <FilterInput value={filter} onChange={setFilter} />
        <div className="flex flex-wrap gap-3">
          {filtered.map((item) => (
            <EntityCard
              key={item.id}
              name={item.name}
              currency={item.currency}
              spent={monthlySpent[item.id] ?? 0}
              onClick={() => { setEditing(item); setDialogOpen(true) }}
            />
          ))}
          <AddCard label="Add Spending" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddSpendingTypeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
