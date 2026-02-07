import { useEffect, useRef, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { useBackup } from '@/hooks/useBackup'
import { getSetting, setSetting } from '@/db/queries/settings'
import { CurrencySelect } from '@/components/CurrencySelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayCurrency, setDisplayCurrency] = useState('')
  const [password, setPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)

  useEffect(() => {
    if (open && db) {
      const saved = getSetting(db, 'display_currency')
      setDisplayCurrency(saved ?? '')
      const pwd = getSetting(db, 'encryption_password')
      setHasPassword(!!pwd)
      setPassword(pwd ?? '')
    }
  }, [open, db])

  function handleSave() {
    if (!db) return
    if (displayCurrency) {
      setSetting(db, 'display_currency', displayCurrency)
    }
    if (password.trim()) {
      setSetting(db, 'encryption_password', password.trim())
    }
    persistDebounced()
    onOpenChange(false)
  }

  async function handleGDriveSignIn() {
    const token = await backup.signInToGDrive()
    if (token) {
      toast.success('Signed in to Google Drive')
    }
  }

  function handleGDriveSignOut() {
    backup.signOutOfGDrive()
    toast.success('Signed out of Google Drive')
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
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handlePush() {
    const ok = await backup.pushToGDrive()
    if (ok) toast.success('Pushed to Google Drive')
    else toast.error('Push failed')
  }

  async function handlePull() {
    const pulled = await backup.pullFromGDrive()
    if (pulled) {
      toast.success('Pulled from Google Drive')
      onOpenChange(false)
    } else {
      toast('Already up to date')
    }
  }

  const syncLabel =
    backup.syncStatus === 'syncing' ? 'Syncing...'
    : backup.syncStatus === 'synced' ? 'Synced'
    : backup.syncStatus === 'error' ? 'Sync error'
    : ''

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

          {/* Encryption */}
          <div>
            <Label htmlFor="enc-password">Encryption Password</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Used for encrypted exports and Google Drive sync.
            </p>
            <Input
              id="enc-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={hasPassword ? '••••••••' : 'Set a password'}
            />
          </div>

          <Separator />

          {/* Google Drive */}
          <div>
            <Label>Google Drive Sync</Label>
            {!backup.isGDriveAvailable ? (
              <p className="text-xs text-muted-foreground mt-1">
                Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID to enable.
              </p>
            ) : !backup.isGDriveSignedIn ? (
              <Button variant="outline" className="mt-2 w-full" onClick={handleGDriveSignIn}>
                Sign in with Google
              </Button>
            ) : (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600">Connected</span>
                  {syncLabel && (
                    <span className="text-xs text-muted-foreground">{syncLabel}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePull} className="flex-1">
                    Pull
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePush} className="flex-1">
                    Push
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGDriveSignOut}
                  className="w-full text-muted-foreground"
                >
                  Sign out
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Manual Backup */}
          <div>
            <Label>Manual Backup</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={backup.exportEncrypted}
                disabled={!hasPassword && !password.trim()}
              >
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
            {!hasPassword && !password.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                Set an encryption password above to enable encrypted export.
              </p>
            )}
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
