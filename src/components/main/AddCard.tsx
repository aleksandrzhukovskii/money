import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/stores/app'

interface AddCardProps {
  label: string
  onClick: () => void
}

const addSizeStyles = {
  small:  { minH: 'min-h-[56px]', icon: 'h-6 w-6', text: 'text-[10px]' },
  medium: { minH: 'min-h-[68px]', icon: 'h-7 w-7', text: 'text-[11px]' },
  large:  { minH: 'min-h-[80px]', icon: 'h-8 w-8', text: 'text-xs' },
} as const

export function AddCard({ label, onClick }: AddCardProps) {
  const cardSize = useAppStore(s => s.cardSize)
  const s = addSizeStyles[cardSize]

  return (
    <Card
      className="w-[calc(50%-0.375rem)] cursor-pointer border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
      onClick={onClick}
    >
      <div className={`flex flex-col items-center justify-center p-2 h-full ${s.minH}`}>
        <Plus className={`${s.icon} text-gray-400`} />
        <span className={`${s.text} text-gray-500 mt-1`}>{label}</span>
      </div>
    </Card>
  )
}
