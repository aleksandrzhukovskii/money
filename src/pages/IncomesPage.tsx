import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { getIncomes } from '@/db/queries/incomes'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddIncomeDialog } from '@/components/main/AddIncomeDialog'
import { TransactionHistoryDialog } from '@/components/main/TransactionHistoryDialog'
import { ReorderDialog } from '@/components/main/ReorderDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { matchesFilter } from '@/lib/filter'
import { Button } from '@/components/ui/button'
import { Settings, Eye, EyeOff, ArrowUpDown } from 'lucide-react'
import type { Income } from '@/types/database'

export function IncomesPage() {
  const { db, persistDebounced } = useDatabase()
  const { monthlyEarned, load, reorder } = useIncomesStore()
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyEntity, setHistoryEntity] = useState<Income | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [allItems, setAllItems] = useState<Income[]>([])

  useEffect(() => {
    if (db) {
      load(db)
      setAllItems(getIncomes(db, false))
    }
  }, [db, load])

  // Reload when dialog closes (entity may have been edited/hidden/shown)
  function reloadAll() {
    if (db) {
      load(db)
      setAllItems(getIncomes(db, false))
    }
  }

  const activeItems = allItems.filter((i) => i.is_active === 1)
  const displayItems = showHidden ? allItems : activeItems
  const hasHidden = allItems.length > activeItems.length

  function getProgress(income: Income): number | undefined {
    if (!income.expected_amount || income.expected_amount <= 0) return undefined
    const earned = monthlyEarned[income.id] ?? 0
    return earned / income.expected_amount
  }

  const filtered = displayItems.filter(i => matchesFilter(i.name, filter))

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Incomes</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setReorderOpen(true)} title="Reorder">
            <ArrowUpDown className="h-5 w-5" />
          </Button>
          {hasHidden && (
            <Button variant="ghost" size="icon" onClick={() => setShowHidden(!showHidden)} title={showHidden ? 'Hide hidden' : 'Show hidden'}>
              {showHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
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
              hidden={income.is_active === 0}
              onClick={() => { setHistoryEntity(income); setHistoryOpen(true) }}
            />
          ))}
          <AddCard label="Add Income" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddIncomeDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) reloadAll() }}
        editing={editing}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReorderDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        title="Reorder Incomes"
        items={activeItems}
        onSave={(ids) => { if (db) { reorder(db, ids); persistDebounced(); reloadAll() } }}
      />

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
