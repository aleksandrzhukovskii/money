import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface ReorderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: { id: number; name: string }[]
  onSave: (orderedIds: number[]) => void
}

export function ReorderDialog({ open, onOpenChange, title, items, onSave }: ReorderDialogProps) {
  const [order, setOrder] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    if (open) setOrder([...items])
  }, [open, items])

  function swap(index: number, direction: -1 | 1) {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setOrder(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Reorder items</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {order.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 mb-1.5"
            >
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={i === 0}
                onClick={() => swap(i, -1)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={i === order.length - 1}
                onClick={() => swap(i, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(order.map(i => i.id)); onOpenChange(false) }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
