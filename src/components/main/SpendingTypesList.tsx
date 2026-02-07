import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { DroppableTarget } from './DroppableTarget'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import { FilterInput } from './FilterInput'
import { matchesFilter } from '@/lib/filter'
import type { SpendingType } from '@/types/database'

interface SpendingTypesListProps {
  onAddClick: () => void
  onEditClick: (spendingType: SpendingType) => void
  activeSource: string | null
  filter: string
  onFilterChange: (value: string) => void
}

export function SpendingTypesList({ onAddClick, onEditClick, activeSource, filter, onFilterChange }: SpendingTypesListProps) {
  const { items, monthlySpent } = useSpendingTypesStore()

  const isValidTarget = activeSource?.startsWith('budget-') ?? false

  const filtered = items.filter(i => matchesFilter(i.name, filter))

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Spendings{items.length > 0 && ` (${filtered.length}/${items.length})`}
        </h2>
        <FilterInput value={filter} onChange={onFilterChange} />
      </div>
      <div className="flex flex-wrap gap-3">
        {filtered.map((item) => (
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
