import { useBudgetsStore } from '@/stores/budgets'
import { DraggableCard } from './DraggableCard'
import { DroppableTarget } from './DroppableTarget'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import type { BudgetWithBalance } from '@/types/database'

interface BudgetsCarouselProps {
  onAddClick: () => void
  onEditClick: (budget: BudgetWithBalance) => void
  activeSource: string | null
}

export function BudgetsCarousel({ onAddClick, onEditClick, activeSource }: BudgetsCarouselProps) {
  const { itemsWithBalances } = useBudgetsStore()

  function isValidTarget(budgetId: number): boolean {
    if (!activeSource) return false
    // Income dragged onto any budget → valid (earning)
    if (activeSource.startsWith('income-')) return true
    // Budget dragged onto a different budget → valid (transfer)
    if (activeSource.startsWith('budget-') && activeSource !== `budget-${budgetId}`) return true
    return false
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Budgets{itemsWithBalances.length > 0 && ` (${itemsWithBalances.length})`}
      </h2>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide">
        {itemsWithBalances.map((budget) => (
          <DroppableTarget
            key={budget.id}
            id={`budget-${budget.id}`}
            isValidTarget={isValidTarget(budget.id)}
          >
            <DraggableCard id={`budget-${budget.id}`}>
              <EntityCard
                name={budget.name}
                currency={budget.currency}
                balance={budget.current_balance}
                onClick={() => onEditClick(budget)}
              />
            </DraggableCard>
          </DroppableTarget>
        ))}
        <AddCard label="Add Budget" onClick={onAddClick} />
      </div>
    </section>
  )
}
