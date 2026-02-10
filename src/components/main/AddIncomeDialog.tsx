import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDatabase } from '@/hooks/useDatabase'
import { useIncomesStore } from '@/stores/incomes'
import { CurrencySelect } from '@/components/CurrencySelect'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseNumber } from '@/lib/parseNumber'
import type { Income } from '@/types/database'

interface AddIncomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Income | null
}

export function AddIncomeDialog({ open, onOpenChange, editing }: AddIncomeDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { items, add, update, remove, merge } = useIncomesStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [expectedAmount, setExpectedAmount] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergeOpen, setMergeOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? '')
      setExpectedAmount(editing?.expected_amount ? String(editing.expected_amount / 100) : '')
      setMergeTarget('')
    }
  }, [open, editing])

  const nameTaken = items.some(
    (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== editing?.id,
  )

  const mergeTargets = editing
    ? items.filter((i) => i.id !== editing.id && i.currency === editing.currency && i.is_active === 1)
    : []

  function handleSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    const expected = parseNumber(expectedAmount) || 0
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

  function handleMerge() {
    if (!db || !editing || !mergeTarget) return
    const target = items.find((i) => i.id === Number(mergeTarget))
    merge(db, editing.id, Number(mergeTarget))
    persistDebounced()
    setMergeOpen(false)
    onOpenChange(false)
    toast.success(`Merged "${editing.name}" into "${target?.name}"`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Income' : 'Add Income'}</DialogTitle>
            <DialogDescription className="sr-only">Income form</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="income-name">Name</Label>
              <Input
                id="income-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Salary, Freelance"
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
            {editing && mergeTargets.length > 0 && (
              <div className="space-y-1.5 border-t pt-4">
                <Label>Merge into</Label>
                <div className="flex gap-2">
                  <Select value={mergeTarget} onValueChange={setMergeTarget}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select income..." />
                    </SelectTrigger>
                    <SelectContent>
                      {mergeTargets.map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    disabled={!mergeTarget}
                    onClick={() => setMergeOpen(true)}
                  >
                    Merge
                  </Button>
                </div>
              </div>
            )}
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

      <ConfirmDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        title="Merge income?"
        description={`This will move all transactions from "${editing?.name}" to "${mergeTargets.find((i) => i.id === Number(mergeTarget))?.name}" and deactivate "${editing?.name}". This cannot be undone.`}
        onConfirm={handleMerge}
        confirmLabel="Merge"
      />
    </>
  )
}
