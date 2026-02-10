import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddIncomeDialog } from '@/components/main/AddIncomeDialog'
import { TransactionHistoryDialog } from '@/components/main/TransactionHistoryDialog'
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyEntity, setHistoryEntity] = useState<Income | null>(null)

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
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Incomes</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              onClick={() => { setHistoryEntity(income); setHistoryOpen(true) }}
            />
          ))}
          <AddCard label="Add Income" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddIncomeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {historyEntity && (
        <TransactionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          entityType="income"
          entityId={historyEntity.id}
          entityName={historyEntity.name}
          currency={historyEntity.currency}
          onEdit={() => {
            setHistoryOpen(false)
            setEditing(historyEntity)
            setDialogOpen(true)
          }}
        />
      )}
    </div>
  )
}
