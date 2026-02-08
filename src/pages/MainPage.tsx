import { useEffect, useMemo, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { insertTransaction } from '@/db/queries/transactions'
import { parseNumber } from '@/lib/parseNumber'
import { EntityCombobox, type ComboboxItem, type ComboboxGroup } from '@/components/main/EntityCombobox'
import { TagPicker } from '@/components/main/TagPicker'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Lock, Unlock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { TransactionType } from '@/types/database'

export function MainPage() {
  const { db, persistDebounced } = useDatabase()
  const { items: incomes, monthlyEarned, load: loadIncomes } = useIncomesStore()
  const { itemsWithBalances: budgets, load: loadBudgets } = useBudgetsStore()
  const { items: spendingTypes, monthlySpent, load: loadSpendingTypes } = useSpendingTypesStore()
  const { load: loadTags } = useTagsStore()

  const [settingsOpen, setSettingsOpen] = useState(false)

  // Selection keys (derive full items from live store data)
  const [fromKey, setFromKey] = useState<{ type: string; id: number } | null>(null)
  const [toKey, setToKey] = useState<{ type: string; id: number } | null>(null)

  // Transaction fields
  const [amount, setAmount] = useState('')
  const [convertedAmount, setConvertedAmount] = useState('')
  const [rateLocked, setRateLocked] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [comment, setComment] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])

  useEffect(() => {
    if (db) {
      loadIncomes(db)
      loadBudgets(db)
      loadSpendingTypes(db)
      loadTags(db)
    }
  }, [db, loadIncomes, loadBudgets, loadSpendingTypes, loadTags])

  // Build combobox items from live store data
  const fromItems: ComboboxItem[] = useMemo(() => [
    ...incomes.map(i => ({
      id: i.id,
      type: 'income' as const,
      name: i.name,
      currency: i.currency,
      displayAmount: monthlyEarned[i.id] ?? 0,
      amountLabel: 'earned',
    })),
    ...budgets.map(b => ({
      id: b.id,
      type: 'budget' as const,
      name: b.name,
      currency: b.currency,
      displayAmount: b.current_balance,
      amountLabel: 'balance',
    })),
  ], [incomes, monthlyEarned, budgets])

  const toItemsAll: ComboboxItem[] = useMemo(() => [
    ...budgets.map(b => ({
      id: b.id,
      type: 'budget' as const,
      name: b.name,
      currency: b.currency,
      displayAmount: b.current_balance,
      amountLabel: 'balance',
    })),
    ...spendingTypes.map(s => ({
      id: s.id,
      type: 'spending' as const,
      name: s.name,
      currency: s.currency,
      displayAmount: monthlySpent[s.id] ?? 0,
      amountLabel: 'spent',
    })),
  ], [budgets, spendingTypes, monthlySpent])

  // Filter "To" items based on "From" selection
  const filteredToItems = useMemo(() => {
    if (!fromKey) return toItemsAll
    if (fromKey.type === 'income') {
      return toItemsAll.filter(i => i.type === 'budget')
    }
    if (fromKey.type === 'budget') {
      return toItemsAll.filter(i => !(i.type === 'budget' && i.id === fromKey.id))
    }
    return toItemsAll
  }, [fromKey, toItemsAll])

  // Derive full items from keys + live store data
  const fromItem = useMemo(
    () => fromKey ? fromItems.find(i => i.type === fromKey.type && i.id === fromKey.id) ?? null : null,
    [fromKey, fromItems],
  )
  const toItem = useMemo(
    () => toKey ? filteredToItems.find(i => i.type === toKey.type && i.id === toKey.id) ?? null : null,
    [toKey, filteredToItems],
  )

  // Clear "To" if it becomes invalid when "From" changes
  useEffect(() => {
    if (!toKey || !fromKey) return
    const isValid = filteredToItems.some(i => i.type === toKey.type && i.id === toKey.id)
    if (!isValid) setToKey(null)
  }, [fromKey, filteredToItems, toKey])

  // Infer transaction type
  function inferType(): TransactionType | null {
    if (!fromItem || !toItem) return null
    if (fromItem.type === 'income' && toItem.type === 'budget') return 'earning'
    if (fromItem.type === 'budget' && toItem.type === 'budget') return 'transfer'
    if (fromItem.type === 'budget' && toItem.type === 'spending') return 'spending'
    return null
  }

  const txType = inferType()

  // Cross-currency
  const isCrossCurrency = !!(fromItem && toItem && fromItem.currency !== toItem.currency)
  const { rate, loading: rateLoading, isStale } = useExchangeRate(
    isCrossCurrency ? fromItem!.currency : '',
    isCrossCurrency ? toItem!.currency : '',
  )

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
    if (!isNaN(a) && !isNaN(c) && a > 0) return c / a
    return rate
  }

  // Validation
  const amountValid = !isNaN(parseNumber(amount)) && parseNumber(amount) > 0
  const crossValid = !isCrossCurrency || (parseNumber(convertedAmount) > 0)
  const canSave = !!txType && amountValid && crossValid

  function handleAdd() {
    if (!db || !fromItem || !toItem || !txType) return

    const amountNum = parseNumber(amount)
    if (isNaN(amountNum) || amountNum <= 0) return

    const crossFields = isCrossCurrency
      ? {
          converted_amount: parseNumber(convertedAmount) || null,
          destination_currency: toItem.currency,
          exchange_rate: effectiveRate(),
        }
      : {}

    const baseData = {
      amount: amountNum,
      source_currency: fromItem.currency,
      date,
      comment: comment.trim(),
      tag_ids: tagIds,
      ...crossFields,
    }

    if (txType === 'earning') {
      insertTransaction(db, { type: 'earning', source_income_id: fromItem.id, destination_budget_id: toItem.id, ...baseData })
    } else if (txType === 'spending') {
      insertTransaction(db, { type: 'spending', source_budget_id: fromItem.id, destination_spending_type_id: toItem.id, ...baseData })
    } else {
      insertTransaction(db, { type: 'transfer', source_budget_id: fromItem.id, destination_budget_id: toItem.id, ...baseData })
    }

    persistDebounced()
    loadBudgets(db)
    loadIncomes(db)
    loadSpendingTypes(db)
    toast.success('Transaction saved')

    // Clear partial state (keep from + date)
    setToKey(null)
    setAmount('')
    setConvertedAmount('')
    setRateLocked(true)
    setComment('')
    setTagIds([])
  }

  // Combobox groups
  const fromGroups: ComboboxGroup[] = [
    { type: 'income', heading: 'Incomes' },
    { type: 'budget', heading: 'Budgets' },
  ]

  const toGroups: ComboboxGroup[] = useMemo(() => {
    if (!fromKey) return [{ type: 'budget' as const, heading: 'Budgets' }, { type: 'spending' as const, heading: 'Spendings' }]
    if (fromKey.type === 'income') return [{ type: 'budget' as const, heading: 'Budgets' }]
    return [{ type: 'budget' as const, heading: 'Budgets' }, { type: 'spending' as const, heading: 'Spendings' }]
  }, [fromKey])

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Money</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="p-4 space-y-4">
        <EntityCombobox
          label="From"
          items={fromItems}
          value={fromKey}
          onChange={setFromKey}
          groups={fromGroups}
          placeholder="Select source..."
        />

        <EntityCombobox
          label="To"
          items={filteredToItems}
          value={toKey}
          onChange={setToKey}
          groups={toGroups}
          placeholder="Select destination..."
        />

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="home-amount">
            Amount{fromItem ? ` (${fromItem.currency})` : ''}
          </Label>
          <Input
            id="home-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {/* Cross-currency */}
        {isCrossCurrency && (
          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
            {rateLoading ? (
              <p className="text-sm text-gray-500">Fetching exchange rate...</p>
            ) : rate ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>1 {fromItem!.currency} = {rate.toFixed(4)} {toItem!.currency}</span>
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
                <Label htmlFor="home-converted">Converted ({toItem!.currency})</Label>
                <Input
                  id="home-converted"
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
          <Label htmlFor="home-date">Date</Label>
          <Input
            id="home-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <Label htmlFor="home-comment">Comment</Label>
          <Input
            id="home-comment"
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

        {/* Add button */}
        <Button className="w-full" onClick={handleAdd} disabled={!canSave}>
          {txType ? `Add ${txType.charAt(0).toUpperCase() + txType.slice(1)}` : 'Add Transaction'}
        </Button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
