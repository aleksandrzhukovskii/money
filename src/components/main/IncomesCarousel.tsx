import { useIncomesStore } from '@/stores/incomes'
import { DraggableCard } from './DraggableCard'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import { FilterInput } from './FilterInput'
import { matchesFilter } from '@/lib/filter'
import type { Income } from '@/types/database'

interface IncomesCarouselProps {
  onAddClick: () => void
  onEditClick: (income: Income) => void
  filter: string
  onFilterChange: (value: string) => void
}

export function IncomesCarousel({ onAddClick, onEditClick, filter, onFilterChange }: IncomesCarouselProps) {
  const { items, monthlyEarned } = useIncomesStore()

  function getProgress(income: Income): number | undefined {
    if (!income.expected_amount || income.expected_amount <= 0) return undefined
    const earned = monthlyEarned[income.id] ?? 0
    return earned / income.expected_amount
  }

  const filtered = items.filter(i => matchesFilter(i.name, filter))

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Incomes{items.length > 0 && ` (${filtered.length}/${items.length})`}
      </h2>
      <FilterInput value={filter} onChange={onFilterChange} />
      <div className="flex flex-wrap gap-3">
        {filtered.map((income) => (
          <DraggableCard key={income.id} id={`income-${income.id}`}>
            <EntityCard
              name={income.name}
              currency={income.currency}
              earned={monthlyEarned[income.id] ?? 0}
              expectedAmount={income.expected_amount}
              progress={getProgress(income)}
              onClick={() => onEditClick(income)}
            />
          </DraggableCard>
        ))}
        <AddCard label="Add Income" onClick={onAddClick} />
      </div>
    </section>
  )
}
