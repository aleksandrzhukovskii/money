import { useBudgetsStore } from '@/stores/budgets'
import { DraggableCard } from './DraggableCard'
import { DroppableTarget } from './DroppableTarget'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import { FilterInput } from './FilterInput'
import { matchesFilter } from '@/lib/filter'
import type { BudgetWithBalance } from '@/types/database'

interface BudgetsCarouselProps {
  onAddClick: () => void
  onEditClick: (budget: BudgetWithBalance) => void
  activeSource: string | null
  filter: string
  onFilterChange: (value: string) => void
}

export function BudgetsCarousel({ onAddClick, onEditClick, activeSource, filter, onFilterChange }: BudgetsCarouselProps) {
  const { itemsWithBalances } = useBudgetsStore()

  function isValidTarget(budgetId: number): boolean {
    if (!activeSource) return false
    if (activeSource.startsWith('income-')) return true
    if (activeSource.startsWith('budget-') && activeSource !== `budget-${budgetId}`) return true
    return false
  }

  const filtered = itemsWithBalances.filter(b => matchesFilter(b.name, filter))

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Budgets{itemsWithBalances.length > 0 && ` (${filtered.length}/${itemsWithBalances.length})`}
      </h2>
      <FilterInput value={filter} onChange={onFilterChange} />
      <div className="flex flex-wrap gap-3">
        {filtered.map((budget) => (
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
