import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { getTransactionsForEntity, deleteTransaction } from '@/db/queries/transactions'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TransactionDialog } from './TransactionDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TransactionWithDetails } from '@/types/database'

interface TransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: 'budget' | 'spending_type'
  entityId: number
  entityName: string
  currency: string
}

function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

const TYPE_LABELS = { earning: 'Earning', spending: 'Spending', transfer: 'Transfer' } as const

export function TransactionHistoryDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  currency,
}: TransactionHistoryDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { load: loadIncomes } = useIncomesStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadSpendingTypes } = useSpendingTypesStore()

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [editingTx, setEditingTx] = useState<TransactionWithDetails | null>(null)

  function refresh() {
    if (db) setTransactions(getTransactionsForEntity(db, entityType, entityId))
  }

  useEffect(() => {
    if (open && db) {
      refresh()
      setDeleteTarget(null)
      setEditingTx(null)
    }
  }, [open, db, entityType, entityId])

  function isInflow(tx: TransactionWithDetails): boolean {
    if (entityType === 'spending_type') return false
    return tx.destination_budget_id === entityId
  }

  function getDisplayCents(tx: TransactionWithDetails): number {
    if (entityType === 'budget') {
      if (tx.destination_budget_id === entityId) {
        return tx.converted_amount ?? tx.amount
      }
      return tx.amount
    }
    return tx.converted_amount ?? tx.amount
  }

  function handleDelete() {
    if (!db || deleteTarget === null) return
    deleteTransaction(db, deleteTarget)
    persistDebounced()
    loadBudgets(db)
    loadIncomes(db)
    loadSpendingTypes(db)
    refresh()
    setDeleteTarget(null)
    toast.success('Transaction deleted')
  }

  function handleEditClose(isOpen: boolean) {
    if (!isOpen) {
      setEditingTx(null)
      refresh()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{entityName}</DialogTitle>
            <DialogDescription>Transaction history</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh] -mx-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => {
                  const inflow = isInflow(tx)
                  const cents = getDisplayCents(tx)

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
                      </div>

                      <span
                        className={`text-sm font-medium whitespace-nowrap ${
                          inflow ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {inflow ? '+' : '-'}{formatAmount(cents, currency)}
                      </span>

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
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
