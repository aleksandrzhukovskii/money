import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'

interface AddCardProps {
  label: string
  onClick: () => void
}

export function AddCard({ label, onClick }: AddCardProps) {
  return (
    <Card
      className="w-40 shrink-0 snap-start cursor-pointer border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center p-3 h-full min-h-[80px]">
        <Plus className="h-8 w-8 text-gray-400" />
        <span className="text-xs text-gray-500 mt-1">{label}</span>
      </div>
    </Card>
  )
}
