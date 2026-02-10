import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/app'
import { formatCents, formatCentsCompact, formatCentsShort } from '@/lib/format'

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
  hidden?: boolean
  onClick?: () => void
}

/** Interpolate from pastel red (0) to pastel green (1) */
function progressColor(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  const hue = clamped * 140
  return `hsl(${hue}, 60%, 92%)`
}

const sizeStyles = {
  small:  'px-3 py-0.5',
  medium: 'px-3 py-1',
  large:  'p-3',
} as const

export function EntityCard({ name, currency, balance, earned, expectedAmount, spent, progress, isDragging, hidden, onClick }: EntityCardProps) {
  const compact = useAppStore(s => s.compactAmounts)
  const cardSize = useAppStore(s => s.cardSize)
  const fmt = compact ? formatCentsShort : formatCents
  const fmtSmall = compact ? formatCentsShort : formatCentsCompact
  const bgStyle = progress !== undefined
    ? { backgroundColor: progressColor(progress) }
    : undefined

  return (
    <Card
      className={`w-[calc(50%-0.375rem)] cursor-pointer select-none transition-opacity ${
        isDragging ? 'opacity-40' : hidden ? 'opacity-40' : ''
      }`}
      style={bgStyle}
      onClick={onClick}
    >
      <CardContent className={sizeStyles[cardSize]}>
        <p className="font-medium truncate">{name}</p>
        <Badge variant="secondary" className="mt-1">{currency}</Badge>
        {balance !== undefined && (
          <p className={`text-sm font-medium mt-1 ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(balance, currency)}
          </p>
        )}
        {earned !== undefined && (
          <p className="text-xs mt-1 text-gray-600">
            {fmtSmall(earned, currency)}
            {expectedAmount !== undefined && expectedAmount > 0 && (
              <> / {fmtSmall(expectedAmount, currency)}</>
            )}
          </p>
        )}
        {spent !== undefined && spent > 0 && (
          <p className="text-xs font-medium mt-1 text-red-600">
            {fmtSmall(spent, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
