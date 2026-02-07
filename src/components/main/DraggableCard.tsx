import { type ReactElement } from 'react'
import { useDraggable } from '@dnd-kit/core'

interface DraggableCardProps {
  id: string
  children: ReactElement<{ isDragging?: boolean }>
}

export function DraggableCard({ id, children }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="shrink-0"
      style={{ touchAction: 'none' }}
    >
      {typeof children.type === 'string'
        ? children
        : { ...children, props: { ...children.props, isDragging } }}
    </div>
  )
}
