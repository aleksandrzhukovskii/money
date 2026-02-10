import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/stores/app'

interface AddCardProps {
  label: string
  onClick: () => void
}

const addMinH = {
  small:  'min-h-[48px]',
  medium: 'min-h-[60px]',
  large:  'min-h-[80px]',
} as const

export function AddCard({ label, onClick }: AddCardProps) {
  const cardSize = useAppStore(s => s.cardSize)

  return (
    <Card
      className="w-[calc(50%-0.375rem)] cursor-pointer border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
      onClick={onClick}
    >
      <div className={`flex flex-col items-center justify-center p-2 h-full ${addMinH[cardSize]}`}>
        <Plus className="h-8 w-8 text-gray-400" />
        <span className="text-xs text-gray-500 mt-1">{label}</span>
      </div>
    </Card>
  )
}
