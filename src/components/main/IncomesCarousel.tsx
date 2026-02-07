import { useIncomesStore } from '@/stores/incomes'
import { DraggableCard } from './DraggableCard'
import { EntityCard } from './EntityCard'
import { AddCard } from './AddCard'
import type { Income } from '@/types/database'

interface IncomesCarouselProps {
  onAddClick: () => void
  onEditClick: (income: Income) => void
}

export function IncomesCarousel({ onAddClick, onEditClick }: IncomesCarouselProps) {
  const { items, monthlyEarned } = useIncomesStore()

  function getProgress(income: Income): number | undefined {
    if (!income.expected_amount || income.expected_amount <= 0) return undefined
    const earned = monthlyEarned[income.id] ?? 0
    return earned / income.expected_amount
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Incomes{items.length > 0 && ` (${items.length})`}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ touchAction: 'pan-y' }}>
        {items.map((income) => (
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
