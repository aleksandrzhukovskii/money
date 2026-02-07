import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { CurrencySelect } from '@/components/CurrencySelect'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
import type { Income } from '@/types/database'

interface AddIncomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Income | null
}

export function AddIncomeDialog({ open, onOpenChange, editing }: AddIncomeDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { items, add, update, remove } = useIncomesStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [expectedAmount, setExpectedAmount] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? '')
      setExpectedAmount(editing?.expected_amount ? String(editing.expected_amount / 100) : '')
    }
  }, [open, editing])

  const nameTaken = items.some(
    (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== editing?.id,
  )

  function handleSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    const expected = parseFloat(expectedAmount) || 0
    if (editing) {
      update(db, editing.id, { name: name.trim(), currency, expected_amount: expected })
    } else {
      add(db, { name: name.trim(), currency, expected_amount: expected })
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
            <DialogTitle>{editing ? 'Edit Income' : 'Add Income'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="income-name">Name</Label>
              <Input
                id="income-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Salary, Freelance"
                autoFocus
              />
              {nameTaken && <p className="text-xs text-red-500 mt-1">Name already exists</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="income-expected">Expected Monthly Amount</Label>
              <Input
                id="income-expected"
                type="number"
                step="0.01"
                min="0"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="mr-auto">
                Delete
              </Button>
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
        title="Delete income source?"
        description="This will deactivate the income source. Existing transactions won't be affected."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  )
}
