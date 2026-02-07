import { Card } from '@/components/ui/card'
import type { PeriodSummary } from '@/db/queries/statistics'

interface SummaryCardsProps {
  current: PeriodSummary
  previous: PeriodSummary
  displayCurrency: string
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function ChangeIndicator({ pct, invertColor }: { pct: number | null; invertColor?: boolean }) {
  if (pct === null) return null
  const isPositive = pct >= 0
  const color = invertColor
    ? (isPositive ? 'text-red-500' : 'text-green-500')
    : (isPositive ? 'text-green-500' : 'text-red-500')
  return (
    <span className={`text-xs font-medium ${color}`}>
      {isPositive ? '+' : ''}{pct}%
    </span>
  )
}

export function SummaryCards({ current, previous, displayCurrency }: SummaryCardsProps) {
  const net = current.total_income - current.total_expense
  const prevNet = previous.total_income - previous.total_expense

  const cards = [
    {
      label: 'Income',
      value: formatAmount(current.total_income),
      pct: pctChange(current.total_income, previous.total_income),
      color: 'text-green-600',
      invertColor: false,
    },
    {
      label: 'Expenses',
      value: formatAmount(current.total_expense),
      pct: pctChange(current.total_expense, previous.total_expense),
      color: 'text-red-600',
      invertColor: true,
    },
    {
      label: 'Net',
      value: formatAmount(Math.abs(net)),
      prefix: net >= 0 ? '+' : '-',
      pct: pctChange(net, prevNet),
      color: net >= 0 ? 'text-green-600' : 'text-red-600',
      invertColor: false,
    },
    {
      label: 'Transactions',
      value: String(current.tx_count),
      pct: pctChange(current.tx_count, previous.tx_count),
      color: 'text-foreground',
      invertColor: false,
      noCurrency: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className={`text-lg font-bold ${c.color}`}>
            {'prefix' in c && c.prefix}{c.value}
            {!c.noCurrency && <span className="text-xs font-normal text-muted-foreground ml-1">{displayCurrency}</span>}
          </p>
          <ChangeIndicator pct={c.pct} invertColor={c.invertColor} />
        </Card>
      ))}
    </div>
  )
}
