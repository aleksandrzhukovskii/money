import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { insertTransaction, updateTransaction } from '@/db/queries/transactions'
import { parseNumber } from '@/lib/parseNumber'
import { TagPicker } from './TagPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { TransactionType, TransactionWithDetails } from '@/types/database'

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: TransactionType
  sourceId: number
  sourceName: string
  sourceCurrency: string
  destinationId: number
  destinationName: string
  destinationCurrency: string
  editing?: TransactionWithDetails | null
}

export function TransactionDialog({
  open,
  onOpenChange,
  type,
  sourceId,
  sourceName,
  sourceCurrency,
  destinationId,
  destinationName,
  destinationCurrency,
  editing,
}: TransactionDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { load: loadIncomes } = useIncomesStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadSpendingTypes } = useSpendingTypesStore()
  const { load: loadTags } = useTagsStore()

  const [amount, setAmount] = useState('')
  const [convertedAmount, setConvertedAmount] = useState('')
  const [rateLocked, setRateLocked] = useState(true)
  const [date, setDate] = useState('')
  const [comment, setComment] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])

  const isEditing = !!editing
  const effType = editing?.type ?? type
  const effSourceName = editing?.source_name ?? sourceName
  const effSourceCurrency = editing?.source_currency ?? sourceCurrency
  const effDestName = editing?.destination_name ?? destinationName
  const effDestCurrency = editing
    ? (editing.destination_currency ?? editing.source_currency)
    : destinationCurrency

  const isCrossCurrency = effSourceCurrency !== effDestCurrency
  const { rate, loading: rateLoading, isStale } = useExchangeRate(
    isCrossCurrency ? effSourceCurrency : '',
    isCrossCurrency ? effDestCurrency : '',
  )

  useEffect(() => {
    if (open) {
      if (editing) {
        setAmount(String(editing.amount / 100))
        setConvertedAmount(editing.converted_amount != null ? String(editing.converted_amount / 100) : '')
        setRateLocked(false)
        setDate(editing.date)
        setComment(editing.comment || '')
        if (db) {
          const tagResult = db.exec('SELECT tag_id FROM transaction_tags WHERE transaction_id = ?', [editing.id])
          setTagIds(tagResult.length > 0 ? tagResult[0]!.values.map(r => r[0] as number) : [])
        }
      } else {
        setAmount('')
        setConvertedAmount('')
        setRateLocked(true)
        setDate(new Date().toISOString().slice(0, 10))
        setComment('')
        setTagIds([])
      }
      if (db) loadTags(db)
    }
  }, [open, db, loadTags, editing])

  // Auto-calculate converted amount when locked
  useEffect(() => {
    if (rateLocked && rate && amount) {
      const val = parseNumber(amount)
      if (!isNaN(val)) {
        setConvertedAmount((val * rate).toFixed(2))
      }
    }
  }, [amount, rate, rateLocked])

  function effectiveRate(): number | null {
    const a = parseNumber(amount)
    const c = parseNumber(convertedAmount)
    if (!isNaN(a) && !isNaN(c) && a > 0) {
      return c / a
    }
    return rate
  }

  function handleSave() {
    if (!db) return
    const amountNum = parseNumber(amount)
    if (isNaN(amountNum) || amountNum <= 0) return

    const crossFields = isCrossCurrency
      ? {
          converted_amount: parseNumber(convertedAmount) || null,
          destination_currency: effDestCurrency,
          exchange_rate: effectiveRate(),
        }
      : {}

    const baseData = {
      amount: amountNum,
      source_currency: effSourceCurrency,
      date,
      comment: comment.trim(),
      tag_ids: tagIds,
      ...crossFields,
    }

    if (editing) {
      updateTransaction(db, editing.id, {
        type: editing.type,
        source_income_id: editing.source_income_id,
        source_budget_id: editing.source_budget_id,
        destination_budget_id: editing.destination_budget_id,
        destination_spending_type_id: editing.destination_spending_type_id,
        ...baseData,
      })
    } else if (effType === 'earning') {
      insertTransaction(db, {
        type: 'earning',
        source_income_id: sourceId,
        destination_budget_id: destinationId,
        ...baseData,
      })
    } else if (effType === 'spending') {
      insertTransaction(db, {
        type: 'spending',
        source_budget_id: sourceId,
        destination_spending_type_id: destinationId,
        ...baseData,
      })
    } else {
      insertTransaction(db, {
        type: 'transfer',
        source_budget_id: sourceId,
        destination_budget_id: destinationId,
        ...baseData,
      })
    }

    persistDebounced()
    loadBudgets(db)
    loadIncomes(db)
    loadSpendingTypes(db)
    toast.success(isEditing ? 'Transaction updated' : 'Transaction saved')
    onOpenChange(false)
  }

  const title = isEditing
    ? `Edit ${effType.charAt(0).toUpperCase() + effType.slice(1)}`
    : `New ${effType.charAt(0).toUpperCase() + effType.slice(1)}`

  const amountValid = !isNaN(parseNumber(amount)) && parseNumber(amount) > 0
  const crossValid = !isCrossCurrency || (parseNumber(convertedAmount) > 0)
  const canSave = amountValid && crossValid

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {effSourceName} → {effDestName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Amount ({effSourceCurrency})</Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Cross-currency section */}
          {isCrossCurrency && (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              {rateLoading ? (
                <p className="text-sm text-gray-500">Fetching exchange rate...</p>
              ) : rate ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>1 {effSourceCurrency} = {rate.toFixed(4)} {effDestCurrency}</span>
                  {isStale && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      cached
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-600">No exchange rate available</p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="tx-converted">Converted ({effDestCurrency})</Label>
                  <Input
                    id="tx-converted"
                    inputMode="decimal"
                    value={convertedAmount}
                    onChange={(e) => setConvertedAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={rateLocked}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setRateLocked(!rateLocked)}
                  title={rateLocked ? 'Unlock to enter custom amount' : 'Lock to auto-calculate'}
                >
                  {rateLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-comment">Comment</Label>
            <Input
              id="tx-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div>
              <TagPicker selectedTagIds={tagIds} onChange={setTagIds} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
