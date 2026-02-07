import { useCallback, useEffect, useRef } from 'react'
import { useDatabase } from './useDatabase'
import { useGoogleDrive } from './useGoogleDrive'
import { encrypt, decrypt } from '@/lib/crypto'
import { getSetting, setSetting } from '@/db/queries/settings'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'

function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useBackup() {
  const { db, exportRaw, importRaw, persist } = useDatabase()
  const drive = useGoogleDrive()
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getPassword(): string | null {
    if (!db) return null
    return getSetting(db, 'encryption_password')
  }

  function reloadAllStores() {
    if (!db) return
    useIncomesStore.getState().load(db)
    useBudgetsStore.getState().load(db)
    useSpendingTypesStore.getState().load(db)
    useTagsStore.getState().load(db)
  }

  // --- Manual export ---

  const exportEncrypted = useCallback(async () => {
    const bytes = exportRaw()
    const password = getPassword()
    if (!bytes || !password) return
    const encrypted = await encrypt(bytes, password)
    downloadBlob(encrypted, `money-tracker-${dateStamp()}.enc`)
  }, [db, exportRaw])

  const exportPlain = useCallback(() => {
    const bytes = exportRaw()
    if (!bytes) return
    downloadBlob(bytes, `money-tracker-${dateStamp()}.db`)
  }, [exportRaw])

  // --- Manual import ---

  const importFile = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer()
    let bytes = new Uint8Array(buffer)

    if (file.name.endsWith('.enc')) {
      const password = getPassword()
      if (!password) throw new Error('No encryption password set')
      bytes = await decrypt(bytes, password)
    }

    await importRaw(bytes)
    reloadAllStores()
  }, [db, importRaw])

  // --- Google Drive sync ---

  const pushToGDrive = useCallback(async () => {
    if (!drive.isSignedIn) return false
    const bytes = exportRaw()
    const password = getPassword()
    if (!bytes || !password) return false
    const encrypted = await encrypt(bytes, password)
    const ok = await drive.upload(encrypted)
    if (ok && db) {
      setSetting(db, 'last_sync_time', new Date().toISOString())
      await persist()
    }
    return ok
  }, [db, exportRaw, persist, drive])

  const pullFromGDrive = useCallback(async (): Promise<boolean> => {
    if (!drive.isSignedIn) return false
    const password = getPassword()
    if (!password) return false

    const remote = await drive.download()
    if (!remote) return false

    // Check if remote is newer
    const localSync = db ? getSetting(db, 'last_sync_time') : null
    if (localSync && new Date(localSync) >= new Date(remote.modifiedTime)) {
      return false // local is current
    }

    const bytes = await decrypt(remote.data, password)
    await importRaw(bytes)
    reloadAllStores()

    if (db) {
      setSetting(db, 'last_sync_time', new Date().toISOString())
      await persist()
    }
    return true
  }, [db, importRaw, persist, drive])

  // Auto-push after writes (debounced 2s)
  const schedulePush = useCallback(() => {
    if (!drive.isSignedIn) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushToGDrive()
    }, 2000)
  }, [drive.isSignedIn, pushToGDrive])

  // Auto-pull on focus regain
  useEffect(() => {
    if (!drive.isSignedIn) return

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        pullFromGDrive()
      }
    }

    // Pull on mount (app open)
    pullFromGDrive()

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [drive.isSignedIn, pullFromGDrive])

  return {
    // Manual
    exportEncrypted,
    exportPlain,
    importFile,
    // Drive sync
    pushToGDrive,
    pullFromGDrive,
    schedulePush,
    // Drive state (forwarded)
    isGDriveSignedIn: drive.isSignedIn,
    isGDriveAvailable: drive.isAvailable,
    syncStatus: drive.syncStatus,
    signInToGDrive: drive.signIn,
    signOutOfGDrive: drive.signOut,
  }
}
