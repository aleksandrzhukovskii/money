import { type ReactElement } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'

interface DraggableCardProps {
  id: string
  children: ReactElement<{ isDragging?: boolean }>
}

export function DraggableCard({ id, children }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })

  return (
    <div ref={setNodeRef} {...attributes} className="relative">
      {typeof children.type === 'string'
        ? children
        : { ...children, props: { ...children.props, isDragging } }}
      <div
        {...listeners}
        style={{ touchAction: 'none' }}
        className="absolute top-1 right-1 p-1.5 text-muted-foreground/40"
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  )
}
