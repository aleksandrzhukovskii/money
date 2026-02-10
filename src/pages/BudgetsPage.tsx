import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useBudgetsStore } from '@/stores/budgets'
import { getBudgetsWithBalances } from '@/db/queries/budgets'
import { EntityCard } from '@/components/main/EntityCard'
import { AddCard } from '@/components/main/AddCard'
import { FilterInput } from '@/components/main/FilterInput'
import { AddBudgetDialog } from '@/components/main/AddBudgetDialog'
import { TransactionHistoryDialog } from '@/components/main/TransactionHistoryDialog'
import { ReorderDialog } from '@/components/main/ReorderDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { matchesFilter } from '@/lib/filter'
import { Button } from '@/components/ui/button'
import { Settings, Eye, EyeOff, ArrowUpDown } from 'lucide-react'
import type { Budget, BudgetWithBalance } from '@/types/database'

export function BudgetsPage() {
  const { db, persistDebounced } = useDatabase()
  const { load, reorder } = useBudgetsStore()
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyEntity, setHistoryEntity] = useState<BudgetWithBalance | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [allItems, setAllItems] = useState<BudgetWithBalance[]>([])

  useEffect(() => {
    if (db) {
      load(db)
      setAllItems(getBudgetsWithBalances(db, false))
    }
  }, [db, load])

  function reloadAll() {
    if (db) {
      load(db)
      setAllItems(getBudgetsWithBalances(db, false))
    }
  }

  const activeItems = allItems.filter((i) => i.is_active === 1)
  const displayItems = showHidden ? allItems : activeItems
  const hasHidden = allItems.length > activeItems.length

  const filtered = displayItems.filter(b => matchesFilter(b.name, filter))

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Budgets</h1>
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
          {filtered.map((budget: BudgetWithBalance) => (
            <EntityCard
              key={budget.id}
              name={budget.name}
              currency={budget.currency}
              balance={budget.current_balance}
              hidden={budget.is_active === 0}
              onClick={() => { setHistoryEntity(budget); setHistoryOpen(true) }}
            />
          ))}
          <AddCard label="Add Budget" onClick={() => { setEditing(null); setDialogOpen(true) }} />
        </div>
      </div>

      <AddBudgetDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) reloadAll() }}
        editing={editing}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReorderDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        title="Reorder Budgets"
        items={activeItems}
        onSave={(ids) => { if (db) { reorder(db, ids); persistDebounced(); reloadAll() } }}
      />

      {historyEntity && (
        <TransactionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          entityType="budget"
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
