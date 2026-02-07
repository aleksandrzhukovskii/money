import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useBudgetsStore } from '@/stores/budgets'
import { CurrencySelect } from '@/components/CurrencySelect'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TransactionHistoryDialog } from './TransactionHistoryDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Budget } from '@/types/database'

interface AddBudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Budget | null
}

export function AddBudgetDialog({ open, onOpenChange, editing }: AddBudgetDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { items, add, update, remove } = useBudgetsStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? '')
      setInitialBalance(editing ? String(editing.initial_balance / 100) : '')
    }
  }, [open, editing])

  const nameTaken = items.some(
    (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== editing?.id,
  )

  function handleSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    const balance = parseFloat(initialBalance) || 0
    if (editing) {
      update(db, editing.id, { name: name.trim(), currency, initial_balance: balance })
    } else {
      add(db, { name: name.trim(), currency, initial_balance: balance })
    }
    persistDebounced()
    onOpenChange(false)
  }

  function handleDelete() {
    if (!db || !editing) return
    remove(db, editing.id)
    persistDebounced()
    setDeleteOpen(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="budget-name">Name</Label>
              <Input
                id="budget-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Account, Cash, Savings"
                autoFocus
              />
              {nameTaken && <p className="text-xs text-red-500 mt-1">Name already exists</p>}
            </div>
            <div>
              <Label>Currency</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div>
              <Label htmlFor="budget-balance">Initial Balance</Label>
              <Input
                id="budget-balance"
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <div className="mr-auto flex gap-2">
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  History
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !currency || nameTaken}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete budget?"
        description="This will deactivate the budget. Existing transactions won't be affected."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      {editing && (
        <TransactionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          entityType="budget"
          entityId={editing.id}
          entityName={editing.name}
          currency={editing.currency}
        />
      )}
    </>
  )
}
