import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EntityDef, ParseResult } from '@/lib/csvImport'

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parseResult: ParseResult
  onConfirm: (entities: EntityDef[]) => void
}

export function CsvImportDialog({
  open,
  onOpenChange,
  parseResult,
  onConfirm,
}: CsvImportDialogProps) {
  const [entities, setEntities] = useState<EntityDef[]>(parseResult.entities)

  function handleTypeChange(index: number, newType: 'income' | 'budget' | 'spending') {
    setEntities(prev => prev.map((e, i) => i === index ? { ...e, type: newType } : e))
  }

  const incomeCount = entities.filter(e => e.type === 'income').length
  const budgetCount = entities.filter(e => e.type === 'budget').length
  const spendingCount = entities.filter(e => e.type === 'spending').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review CSV Import</DialogTitle>
          <DialogDescription>
            {parseResult.rows.length} transactions, {entities.length} entities, {parseResult.tags.length} tags
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-gray-500 flex gap-3">
          <span>{incomeCount} incomes</span>
          <span>{budgetCount} budgets</span>
          <span>{spendingCount} spendings</span>
        </div>

        <div className="overflow-y-auto max-h-[50vh] -mx-2 px-2">
          <div className="space-y-1">
            {entities.map((entity, i) => (
              <div key={entity.name} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 text-sm truncate">{entity.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{entity.currency}</span>
                <Select
                  value={entity.type}
                  onValueChange={(v) => handleTypeChange(i, v as 'income' | 'budget' | 'spending')}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="budget">Budget</SelectItem>
                    <SelectItem value="spending">Spending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(entities)}>
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
