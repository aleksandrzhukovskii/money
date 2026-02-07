import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface DroppableTargetProps {
  id: string
  children: ReactNode
  isValidTarget?: boolean
}

export function DroppableTarget({ id, children, isValidTarget = false }: DroppableTargetProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const highlight = isOver && isValidTarget

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 rounded-lg ${
        highlight ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
      }`}
    >
      {children}
    </div>
  )
}
