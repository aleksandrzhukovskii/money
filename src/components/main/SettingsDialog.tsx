import { useEffect, useRef, useState } from 'react'
import { useDatabase, deleteLocalDatabase, resetDatabase } from '@/hooks/useDatabase'
import { useBackup } from '@/hooks/useBackup'
import { useAuthStore } from '@/stores/auth'
import { clearCredentials } from '@/components/AuthScreen'
import { isBiometricAvailable, hasBiometricCredential, registerBiometric, removeBiometric } from '@/lib/biometric'
import { getSetting, setSetting } from '@/db/queries/settings'
import { CurrencySelect } from '@/components/CurrencySelect'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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

  const [displayCurrency, setDisplayCurrency] = useState('')
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)

  useEffect(() => {
    if (open && db) {
      setDisplayCurrency(getSetting(db, 'display_currency') ?? '')
    }
    if (open) {
      isBiometricAvailable().then(setBiometricSupported)
      setBiometricEnabled(hasBiometricCredential())
    }
  }, [open, db])

  function handleSave() {
    if (!db || !displayCurrency) return
    setSetting(db, 'display_currency', displayCurrency)
    persistDebounced()
    onOpenChange(false)
  }

  async function handleSyncNow() {
    const ok = await backup.push()
    if (ok) toast.success('Synced to GitHub')
    else toast.error('Sync failed')
  }

  async function handlePull() {
    const pulled = await backup.pull()
    if (pulled) {
      toast.success('Pulled from GitHub')
      onOpenChange(false)
    } else {
      toast('Already up to date')
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

  async function handleEnableBiometric() {
    const password = useAuthStore.getState().password
    if (!password) return
    try {
      const ok = await registerBiometric(password)
      if (ok) {
        setBiometricEnabled(true)
        toast.success('Biometric unlock enabled')
      } else {
        toast.error('Biometric not supported on this device')
      }
    } catch {
      toast.error('Failed to enable biometric')
    }
  }

  function handleDisableBiometric() {
    removeBiometric()
    setBiometricEnabled(false)
    toast.success('Biometric unlock disabled')
  }

  function handleLogout() {
    useAuthStore.getState().clearAuth()
    clearCredentials()
    removeBiometric()
    deleteLocalDatabase()
    resetDatabase()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
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

          {biometricSupported && (
            <>
              <Separator />

              {/* Biometric Unlock */}
              <div>
                <Label>Biometric Unlock</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Use Face ID or Touch ID to unlock the app.
                </p>
                <div className="mt-2">
                  {biometricEnabled ? (
                    <Button variant="outline" size="sm" onClick={handleDisableBiometric}>
                      Disable Face ID
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleEnableBiometric}>
                      Enable Face ID
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

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
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".enc,.db"
              className="hidden"
              onChange={handleImport}
            />
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
  )
}
