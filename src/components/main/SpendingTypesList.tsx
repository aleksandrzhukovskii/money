import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { DroppableTarget } from './DroppableTarget'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import { matchesFilter } from '@/lib/filter'
import type { SpendingType } from '@/types/database'

interface SpendingTypesListProps {
  onAddClick: () => void
  onEditClick: (spendingType: SpendingType) => void
  activeSource: string | null
  filter: string
}

export function SpendingTypesList({ onAddClick, onEditClick, activeSource, filter }: SpendingTypesListProps) {
  const { items, monthlySpent } = useSpendingTypesStore()

  const isValidTarget = activeSource?.startsWith('budget-') ?? false

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Spendings{items.length > 0 && ` (${items.length})`}
      </h2>
      <div className="flex flex-wrap gap-3">
        {items.filter(i => matchesFilter(i.name, filter)).map((item) => (
          <DroppableTarget
            key={item.id}
            id={`spending-${item.id}`}
            isValidTarget={isValidTarget}
          >
            <EntityCard
              name={item.name}
              currency={item.currency}
              spent={monthlySpent[item.id] ?? 0}
              onClick={() => onEditClick(item)}
            />
          </DroppableTarget>
        ))}
        <AddCard label="Add Spending" onClick={onAddClick} />
      </div>
    </section>
  )
}
