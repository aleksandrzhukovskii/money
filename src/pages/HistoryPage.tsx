import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useAppStore } from '@/stores/app'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { getTransactions, deleteTransaction } from '@/db/queries/transactions'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TransactionDialog } from '@/components/main/TransactionDialog'
import { TagMultiSelect } from '@/components/main/TagMultiSelect'
import { SettingsDialog } from '@/components/main/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCentsShort } from '@/lib/format'
import type { TransactionWithDetails } from '@/types/database'

const PAGE_SIZE = 50
const TYPE_LABELS = { earning: 'Earning', spending: 'Spending', transfer: 'Transfer' } as const

function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function HistoryPage() {
  const { db, persistDebounced } = useDatabase()
  const compact = useAppStore(s => s.compactAmounts)
  const fmt = compact ? formatCentsShort : formatAmount
  const { load: loadIncomes } = useIncomesStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadSpendingTypes } = useSpendingTypesStore()
  const { load: loadTags } = useTagsStore()

  const [settingsOpen, setSettingsOpen] = useState(false)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])

  // Data
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [editingTx, setEditingTx] = useState<TransactionWithDetails | null>(null)

  useEffect(() => {
    if (db) {
      loadIncomes(db)
      loadBudgets(db)
      loadSpendingTypes(db)
      loadTags(db)
    }
  }, [db, loadIncomes, loadBudgets, loadSpendingTypes, loadTags])

  function loadTransactions(append = false) {
    if (!db) return
    const offset = append ? transactions.length : 0
    const results = getTransactions(db, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      commentSearch: search || undefined,
      limit: PAGE_SIZE + 1,
      offset,
    })
    const more = results.length > PAGE_SIZE
    const page = more ? results.slice(0, PAGE_SIZE) : results
    setHasMore(more)
    setTransactions(prev => append ? [...prev, ...page] : page)
  }

  // Reload on filter change
  useEffect(() => {
    if (db) loadTransactions()
  }, [db, dateFrom, dateTo, search, tagIds])

  function handleDelete() {
    if (!db || deleteTarget === null) return
    deleteTransaction(db, deleteTarget)
    persistDebounced()
    loadBudgets(db)
    loadIncomes(db)
    loadSpendingTypes(db)
    setDeleteTarget(null)
    toast.success('Transaction deleted')
    loadTransactions()
  }

  function handleEditClose(isOpen: boolean) {
    if (!isOpen) {
      setEditingTx(null)
      loadTransactions()
    }
  }

  function getAmountDisplay(tx: TransactionWithDetails) {
    const isEarning = tx.type === 'earning'
    const primaryCents = tx.amount
    const primaryCurrency = tx.source_currency
    const isCross = tx.converted_amount != null && tx.destination_currency != null

    return {
      isEarning,
      primary: fmt(primaryCents, primaryCurrency),
      secondary: isCross ? fmt(tx.converted_amount!, tx.destination_currency!) : null,
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">History</h1>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Date filters */}
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 text-base"
            placeholder="From"
          />
          <span className="text-xs text-gray-400 shrink-0">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 text-base"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 text-gray-400"
              onClick={() => { setDateFrom(''); setDateTo('') }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search + Tags */}
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comments..."
            className="flex-1 text-base"
          />
          <div className="w-36 shrink-0">
            <TagMultiSelect selectedTagIds={tagIds} onChange={setTagIds} />
          </div>
        </div>

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => {
              const display = getAmountDisplay(tx)
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => setEditingTx(tx)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{tx.date}</span>
                      <span className="text-xs font-medium text-gray-500">
                        {TYPE_LABELS[tx.type]}
                      </span>
                    </div>
                    <p className="text-sm truncate">
                      {tx.source_name} → {tx.destination_name}
                    </p>
                    {tx.comment && (
                      <p className="text-xs text-gray-400 truncate">{tx.comment}</p>
                    )}
                    {tx.tags && tx.tags.length > 0 && (
                      <p className="text-[10px] text-gray-400 truncate">{tx.tags.map(t => `#${t}`).join(' ')}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-medium whitespace-nowrap ${
                        display.isEarning ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {display.isEarning ? '+' : '-'}{display.primary}
                    </span>
                    {display.secondary && (
                      <p className="text-[10px] text-gray-400 whitespace-nowrap">
                        ({display.secondary})
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-gray-400 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(tx.id) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {hasMore && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => loadTransactions(true)}
          >
            Load more
          </Button>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete transaction?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      {editingTx && (
        <TransactionDialog
          open={!!editingTx}
          onOpenChange={handleEditClose}
          editing={editingTx}
          type={editingTx.type}
          sourceId={0}
          sourceName=""
          sourceCurrency=""
          destinationId={0}
          destinationName=""
          destinationCurrency=""
        />
      )}
    </div>
  )
}
