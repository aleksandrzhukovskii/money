import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { IncomesCarousel } from '@/components/main/IncomesCarousel'
import { BudgetsCarousel } from '@/components/main/BudgetsCarousel'
import { SpendingTypesList } from '@/components/main/SpendingTypesList'
import { EntityCard } from '@/components/main/EntityCard'
import { AddIncomeDialog } from '@/components/main/AddIncomeDialog'
import { AddBudgetDialog } from '@/components/main/AddBudgetDialog'
import { AddSpendingTypeDialog } from '@/components/main/AddSpendingTypeDialog'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { TransactionDialog } from '@/components/main/TransactionDialog'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import type { Income, Budget, BudgetWithBalance, SpendingType, TransactionType } from '@/types/database'

interface TransactionDialogState {
  type: TransactionType
  sourceId: number
  sourceName: string
  sourceCurrency: string
  destinationId: number
  destinationName: string
  destinationCurrency: string
}

export function MainPage() {
  const { db } = useDatabase()
  const { items: incomes, load: loadIncomes } = useIncomesStore()
  const { itemsWithBalances: budgets, load: loadBudgets } = useBudgetsStore()
  const { items: spendingTypes, load: loadSpendingTypes } = useSpendingTypesStore()
  const { load: loadTags } = useTagsStore()

  // Dialog states
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false)
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [spendingDialogOpen, setSpendingDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  // Transaction dialog
  const [txDialog, setTxDialog] = useState<TransactionDialogState | null>(null)

  // Editing states
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [editingSpendingType, setEditingSpendingType] = useState<SpendingType | null>(null)

  // Filters (per section)
  const [incomeFilter, setIncomeFilter] = useState('')
  const [budgetFilter, setBudgetFilter] = useState('')
  const [spendingFilter, setSpendingFilter] = useState('')

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  useEffect(() => {
    if (db) {
      loadIncomes(db)
      loadBudgets(db)
      loadSpendingTypes(db)
      loadTags(db)
    }
  }, [db, loadIncomes, loadBudgets, loadSpendingTypes, loadTags])

  function parseDndId(dndId: string): { type: string; id: number } {
    const [type, idStr] = dndId.split('-')
    return { type: type!, id: parseInt(idStr!, 10) }
  }

  function getOverlayProps(dndId: string): { name: string; currency: string; balance?: number } | null {
    const { type, id } = parseDndId(dndId)
    if (type === 'income') {
      const item = incomes.find((i) => i.id === id)
      if (item) return { name: item.name, currency: item.currency }
    }
    if (type === 'budget') {
      const item = budgets.find((b) => b.id === id)
      if (item) return { name: item.name, currency: item.currency, balance: item.current_balance }
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const source = parseDndId(active.id as string)
    const target = parseDndId(over.id as string)

    if (source.type === 'income' && target.type === 'budget') {
      const income = incomes.find((i) => i.id === source.id)
      const budget = budgets.find((b) => b.id === target.id)
      if (income && budget) {
        setTxDialog({
          type: 'earning',
          sourceId: income.id,
          sourceName: income.name,
          sourceCurrency: income.currency,
          destinationId: budget.id,
          destinationName: budget.name,
          destinationCurrency: budget.currency,
        })
      }
    } else if (source.type === 'budget' && target.type === 'spending') {
      const budget = budgets.find((b) => b.id === source.id)
      const st = spendingTypes.find((s) => s.id === target.id)
      if (budget && st) {
        setTxDialog({
          type: 'spending',
          sourceId: budget.id,
          sourceName: budget.name,
          sourceCurrency: budget.currency,
          destinationId: st.id,
          destinationName: st.name,
          destinationCurrency: st.currency,
        })
      }
    } else if (source.type === 'budget' && target.type === 'budget' && source.id !== target.id) {
      const srcBudget = budgets.find((b) => b.id === source.id)
      const dstBudget = budgets.find((b) => b.id === target.id)
      if (srcBudget && dstBudget) {
        setTxDialog({
          type: 'transfer',
          sourceId: srcBudget.id,
          sourceName: srcBudget.name,
          sourceCurrency: srcBudget.currency,
          destinationId: dstBudget.id,
          destinationName: dstBudget.name,
          destinationCurrency: dstBudget.currency,
        })
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  const overlayProps = activeId ? getOverlayProps(activeId) : null

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Money</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsDialogOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="p-4 space-y-6">
          <IncomesCarousel
            onAddClick={() => { setEditingIncome(null); setIncomeDialogOpen(true) }}
            onEditClick={(income) => { setEditingIncome(income); setIncomeDialogOpen(true) }}
            filter={incomeFilter}
            onFilterChange={setIncomeFilter}
          />

          <BudgetsCarousel
            onAddClick={() => { setEditingBudget(null); setBudgetDialogOpen(true) }}
            onEditClick={(budget: BudgetWithBalance) => { setEditingBudget(budget); setBudgetDialogOpen(true) }}
            activeSource={activeId}
            filter={budgetFilter}
            onFilterChange={setBudgetFilter}
          />

          <SpendingTypesList
            onAddClick={() => { setEditingSpendingType(null); setSpendingDialogOpen(true) }}
            onEditClick={(st) => { setEditingSpendingType(st); setSpendingDialogOpen(true) }}
            activeSource={activeId}
            filter={spendingFilter}
            onFilterChange={setSpendingFilter}
          />
        </div>

        <DragOverlay>
          {overlayProps && <EntityCard {...overlayProps} />}
        </DragOverlay>
      </DndContext>

      <AddIncomeDialog
        open={incomeDialogOpen}
        onOpenChange={setIncomeDialogOpen}
        editing={editingIncome}
      />
      <AddBudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        editing={editingBudget}
      />
      <AddSpendingTypeDialog
        open={spendingDialogOpen}
        onOpenChange={setSpendingDialogOpen}
        editing={editingSpendingType}
      />
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
      {txDialog && (
        <TransactionDialog
          open={true}
          onOpenChange={(open) => { if (!open) setTxDialog(null) }}
          {...txDialog}
        />
      )}
    </div>
  )
}
