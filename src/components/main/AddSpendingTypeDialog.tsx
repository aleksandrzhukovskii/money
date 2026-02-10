import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDatabase } from '@/hooks/useDatabase'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
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
import type { SpendingType } from '@/types/database'

interface AddSpendingTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: SpendingType | null
}

export function AddSpendingTypeDialog({ open, onOpenChange, editing }: AddSpendingTypeDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { items, add, update, remove, merge, changeCurrency } = useSpendingTypesStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [currencyChangeOpen, setCurrencyChangeOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? '')
      setMergeTarget('')
    }
  }, [open, editing])

  const nameTaken = items.some(
    (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== editing?.id,
  )

  const mergeTargets = editing
    ? items.filter((i) => i.id !== editing.id && i.currency === editing.currency && i.is_active === 1)
    : []

  const currencyChanged = editing && currency && currency !== editing.currency

  function handleSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    if (editing && currencyChanged) {
      setCurrencyChangeOpen(true)
      return
    }
    doSave()
  }

  function doSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    if (editing) {
      if (currencyChanged) {
        changeCurrency(db, editing.id, currency)
      }
      update(db, editing.id, { name: name.trim(), currency })
    } else {
      add(db, { name: name.trim(), currency })
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

  function handleCurrencyChangeConfirm() {
    setCurrencyChangeOpen(false)
    doSave()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Spending' : 'Add Spending'}</DialogTitle>
            <DialogDescription className="sr-only">Spending type form</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Name</Label>
              <Input
                id="st-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food, Rent, Transport"
              />
              {nameTaken && <p className="text-xs text-red-500 mt-1">Name already exists</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
              {currencyChanged && (
                <p className="text-xs text-amber-600 mt-1">
                  Changing currency will recalculate all transaction amounts for this category.
                </p>
              )}
            </div>
            {editing && mergeTargets.length > 0 && (
              <div className="space-y-1.5 border-t pt-4">
                <Label>Merge into</Label>
                <div className="flex gap-2">
                  <Select value={mergeTarget} onValueChange={setMergeTarget}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select spending..." />
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
        title="Delete spending?"
        description="This will deactivate the spending category. Existing transactions won't be affected."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        title="Merge spending?"
        description={`This will move all transactions from "${editing?.name}" to "${mergeTargets.find((i) => i.id === Number(mergeTarget))?.name}" and deactivate "${editing?.name}". This cannot be undone.`}
        onConfirm={handleMerge}
        confirmLabel="Merge"
      />

      <ConfirmDialog
        open={currencyChangeOpen}
        onOpenChange={setCurrencyChangeOpen}
        title="Change currency?"
        description={`This will change "${editing?.name}" from ${editing?.currency} to ${currency} and recalculate all transaction amounts using exchange rates. This cannot be undone.`}
        onConfirm={handleCurrencyChangeConfirm}
        confirmLabel="Change"
        variant="default"
      />
    </>
  )
}
