import { useEffect, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
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
import type { SpendingType } from '@/types/database'

interface AddSpendingTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: SpendingType | null
}

export function AddSpendingTypeDialog({ open, onOpenChange, editing }: AddSpendingTypeDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const { items, add, update, remove } = useSpendingTypesStore()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? '')
    }
  }, [open, editing])

  const nameTaken = items.some(
    (i) => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== editing?.id,
  )

  function handleSave() {
    if (!db || !name.trim() || !currency || nameTaken) return
    if (editing) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Spending' : 'Add Spending'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Name</Label>
              <Input
                id="st-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food, Rent, Transport"
                autoFocus
              />
              {nameTaken && <p className="text-xs text-red-500 mt-1">Name already exists</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={currency} onChange={setCurrency} />
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
        title="Delete spending?"
        description="This will deactivate the spending category. Existing transactions won't be affected."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      {editing && (
        <TransactionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          entityType="spending_type"
          entityId={editing.id}
          entityName={editing.name}
          currency={editing.currency}
        />
      )}
    </>
  )
}
