import { useEffect, useState } from 'react'
import { Check, CloudOff, Loader2, CloudUpload } from 'lucide-react'
import { toast } from 'sonner'
import { useSyncStore } from '@/stores/sync'
import { useBackup } from '@/hooks/useBackup'

/** How long the "Synced" confirmation stays on screen after a successful push. */
const SYNCED_VISIBLE_MS = 4000

export function SyncIndicator() {
  const status = useSyncStore((s) => s.status)
  const pending = useSyncStore((s) => s.pending)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const backup = useBackup()
  const [showSynced, setShowSynced] = useState(false)

  useEffect(() => {
    if (!lastSyncedAt) return
    setShowSynced(true)
    const timer = setTimeout(() => setShowSynced(false), SYNCED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [lastSyncedAt])

  async function handleRetry() {
    const result = await backup.push()
    if (result.ok) toast.success('Synced to GitHub')
    else toast.error(`Sync failed: ${result.error}`)
  }

  const base = 'fixed right-3 z-40 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm'
  const style = { top: 'calc(var(--safe-area-top) + 0.5rem)' }

  if (status === 'error') {
    return (
      <button
        onClick={handleRetry}
        className={`${base} border-red-200 bg-red-50 text-red-700`}
        style={style}
      >
        <CloudOff className="size-3.5" />
        Not synced — retry
      </button>
    )
  }

  if (status === 'syncing') {
    return (
      <div className={`${base} border-slate-200 bg-slate-50 text-slate-600`} style={style}>
        <Loader2 className="size-3.5 animate-spin" />
        Syncing...
      </div>
    )
  }

  if (pending) {
    return (
      <div className={`${base} border-amber-200 bg-amber-50 text-amber-700`} style={style}>
        <CloudUpload className="size-3.5" />
        Not synced yet
      </div>
    )
  }

  if (showSynced) {
    return (
      <div className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`} style={style}>
        <Check className="size-3.5" />
        Synced
      </div>
    )
  }

  return null
}
