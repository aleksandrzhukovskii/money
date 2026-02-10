import { useEffect, useRef, useState } from 'react'
import { useDatabase, deleteLocalDatabase, resetDatabase } from '@/hooks/useDatabase'
import { useBackup } from '@/hooks/useBackup'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'
import { clearCredentials } from '@/components/AuthScreen'
import { getSetting, setSetting } from '@/db/queries/settings'
import { CurrencySelect } from '@/components/CurrencySelect'
import type { CardSize } from '@/stores/app'
import { CsvImportDialog } from './CsvImportDialog'
import { parseCsv, executeCsvImport } from '@/lib/csvImport'
import type { ParseResult, EntityDef } from '@/lib/csvImport'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { db, persistDebounced } = useDatabase()
  const backup = useBackup()
  const { repo } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [displayCurrency, setDisplayCurrency] = useState('')
  const compactAmounts = useAppStore(s => s.compactAmounts)
  const toastPosition = useAppStore(s => s.toastPosition)
  const cardSize = useAppStore(s => s.cardSize)
  const [csvImportData, setCsvImportData] = useState<ParseResult | null>(null)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  useEffect(() => {
    if (open && db) {
      setDisplayCurrency(getSetting(db, 'display_currency') ?? '')
    }
  }, [open, db])

  function handleSave() {
    if (!db || !displayCurrency) return
    setSetting(db, 'display_currency', displayCurrency)
    persistDebounced()
    onOpenChange(false)
  }

  async function handleSyncNow() {
    const result = await backup.push()
    if (result.ok) toast.success('Synced to GitHub')
    else toast.error(`Sync failed: ${result.error}`)
  }

  async function handlePull() {
    const result = await backup.pull()
    if (result.ok) {
      if (result.pulled) {
        toast.success('Pulled from GitHub')
        onOpenChange(false)
      } else {
        toast('Already up to date')
      }
    } else {
      toast.error(`Pull failed: ${result.error}`)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await backup.importFile(file)
      toast.success('Database imported successfully')
      onOpenChange(false)
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleLogout() {
    useAuthStore.getState().clearAuth()
    clearCredentials()
    deleteLocalDatabase()
    resetDatabase()
    onOpenChange(false)
  }

  async function handleCheckUpdate() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.update()
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          toast.success('Update found — reloading...')
          setTimeout(() => window.location.reload(), 1000)
        } else {
          toast('App is up to date')
        }
      } else {
        toast('No service worker registered')
      }
    } catch (err) {
      toast.error(`Update check failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function handleCsvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = parseCsv(reader.result as string)
        if (result.rows.length === 0) {
          toast.error('No transactions found in CSV')
          return
        }
        setCsvImportData(result)
        setCsvImportOpen(true)
      } catch (err) {
        toast.error(`CSV parse error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  function handleCsvConfirm(entities: EntityDef[]) {
    if (!db || !csvImportData) return
    try {
      executeCsvImport(db, csvImportData.rows, entities, csvImportData.tags)
      persistDebounced()
      useIncomesStore.getState().load(db)
      useBudgetsStore.getState().load(db)
      useSpendingTypesStore.getState().load(db)
      useTagsStore.getState().load(db)
      toast.success(`Imported ${csvImportData.rows.length} transactions`)
      setCsvImportOpen(false)
      setCsvImportData(null)
      onOpenChange(false)
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">App settings</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Display Currency */}
          <div>
            <Label>Display Currency</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Statistics will convert all amounts to this currency.
            </p>
            <CurrencySelect value={displayCurrency} onChange={setDisplayCurrency} />
          </div>

          {/* Compact Amounts */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={compactAmounts}
                onChange={(e) => {
                  const v = e.target.checked
                  useAppStore.getState().setCompactAmounts(v)
                  if (db) { setSetting(db, 'compact_amounts', v ? 'true' : 'false'); persistDebounced() }
                }}
                className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              <span className="text-sm font-medium">Compact Amounts</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Shorten large numbers (e.g. 23k, 1.5m) on cards and in history.
            </p>
          </div>

          {/* Toast Position */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={toastPosition === 'bottom-center'}
                onChange={(e) => {
                  const v = e.target.checked ? 'bottom-center' : 'top-center'
                  useAppStore.getState().setToastPosition(v)
                  if (db) { setSetting(db, 'toast_position', v); persistDebounced() }
                }}
                className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              <span className="text-sm font-medium">Toast at Bottom</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Show notifications at the bottom of the screen instead of the top.
            </p>
          </div>

          {/* Card Size */}
          <div>
            <Label>Card Size</Label>
            <div className="flex gap-2 mt-1">
              {(['small', 'medium', 'large'] as CardSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    useAppStore.getState().setCardSize(size)
                    if (db) { setSetting(db, 'card_size', size); persistDebounced() }
                  }}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors ${
                    cardSize === size
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Sync */}
          <div>
            <Label>GitHub Sync</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Connected to {repo}
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleSyncNow}>
                Sync Now
              </Button>
              <Button variant="outline" size="sm" onClick={handlePull}>
                Pull
              </Button>
            </div>
          </div>

          <Separator />

          {/* Manual Backup */}
          <div>
            <Label>Manual Backup</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={backup.exportEncrypted}>
                Export Encrypted
              </Button>
              <Button variant="outline" size="sm" onClick={backup.exportPlain}>
                Export Plain
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Import File
              </Button>
              <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
                Import CSV
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".enc,.db"
              className="hidden"
              onChange={handleImport}
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFileSelected}
            />
          </div>

          <Separator />

          {/* App Update */}
          <div>
            <Label>App Update</Label>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleCheckUpdate}>
                Check for Updates
              </Button>
            </div>
          </div>

          <Separator />

          {/* Logout */}
          <div>
            <Button variant="destructive" size="sm" onClick={handleLogout} className="w-full">
              Logout
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!displayCurrency}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {csvImportData && (
      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={(v) => { setCsvImportOpen(v); if (!v) setCsvImportData(null) }}
        parseResult={csvImportData}
        onConfirm={handleCsvConfirm}
      />
    )}
    </>
  )
}
