import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface EntityCardProps {
  name: string
  currency: string
  balance?: number
  /** Earned this month in cents — shown as "earned / expected" when expectedAmount is set */
  earned?: number
  /** Expected monthly amount in cents */
  expectedAmount?: number
  /** Monthly spent total in cents */
  spent?: number
  /** 0–1 progress ratio for background coloring (red→green) */
  progress?: number
  isDragging?: boolean
  onClick?: () => void
}

/** Format cents (integer) as a currency string */
function formatBalance(cents: number, currency: string) {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Interpolate from pastel red (0) to pastel green (1) */
function progressColor(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  // Hue: 0 (red) → 140 (green)
  const hue = clamped * 140
  return `hsl(${hue}, 60%, 92%)`
}

/** Format cents as a compact number (no currency symbol) */
function formatCompact(cents: number, currency: string) {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function EntityCard({ name, currency, balance, earned, expectedAmount, spent, progress, isDragging, onClick }: EntityCardProps) {
  const bgStyle = progress !== undefined
    ? { backgroundColor: progressColor(progress) }
    : undefined

  return (
    <Card
      className={`w-40 shrink-0 cursor-pointer select-none transition-opacity ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={bgStyle}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <p className="font-medium truncate">{name}</p>
        <Badge variant="secondary" className="mt-1">{currency}</Badge>
        {balance !== undefined && (
          <p className={`text-sm font-medium mt-1 ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatBalance(balance, currency)}
          </p>
        )}
        {expectedAmount !== undefined && expectedAmount > 0 && (
          <p className="text-xs mt-1 text-gray-600">
            {formatCompact(earned ?? 0, currency)} / {formatCompact(expectedAmount, currency)}
          </p>
        )}
        {spent !== undefined && spent > 0 && (
          <p className="text-xs font-medium mt-1 text-red-600">
            {formatCompact(spent, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
