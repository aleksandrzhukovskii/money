import { useCallback, useRef, useState } from 'react'
import { useDatabase, getDb, markClean, markDirty } from './useDatabase'
import { useAuthStore } from '@/stores/auth'
import { encrypt, decrypt } from '@/lib/crypto'
import { getFile, putFile } from '@/lib/githubSync'
import { setSetting } from '@/db/queries/settings'
import { useIncomesStore } from '@/stores/incomes'
import { useBudgetsStore } from '@/stores/budgets'
import { useSpendingTypesStore } from '@/stores/spendingTypes'
import { useTagsStore } from '@/stores/tags'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

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

function getPassword(): string | null {
  return useAuthStore.getState().password
}

function getGitHubConfig(): { repo: string; token: string } | null {
  const { repo, token } = useAuthStore.getState()
  if (!repo || !token) return null
  return { repo, token }
}

// Module-level so all useBackup instances share the same SHA
let _remoteSha: string | null = null

export function useBackup() {
  const { exportRaw, importRaw, persist } = useDatabase()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isGitHubConfigured = useAuthStore(
    (state) => !!(state.repo && state.token),
  )

  function reloadAllStores() {
    const currentDb = getDb()
    if (!currentDb) return
    useIncomesStore.getState().load(currentDb)
    useBudgetsStore.getState().load(currentDb)
    useSpendingTypesStore.getState().load(currentDb)
    useTagsStore.getState().load(currentDb)
  }

  // --- Manual export ---

  const exportEncrypted = useCallback(async () => {
    const bytes = exportRaw()
    const password = getPassword()
    if (!bytes || !password) return
    const encrypted = await encrypt(bytes, password)
    downloadBlob(encrypted, `money-tracker-${dateStamp()}.enc`)
  }, [exportRaw])

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
    markDirty()
  }, [importRaw])

  // --- GitHub sync ---

  const push = useCallback(async (): Promise<boolean> => {
    const config = getGitHubConfig()
    const password = getPassword()
    const bytes = exportRaw()
    if (!config || !password || !bytes) return false

    try {
      setSyncStatus('syncing')
      const encrypted = await encrypt(bytes, password)
      const newSha = await putFile(config.repo, config.token, encrypted, _remoteSha)
      _remoteSha = newSha
      const currentDb = getDb()
      if (currentDb) {
        setSetting(currentDb, 'last_sync_time', new Date().toISOString())
        await persist()
      }
      markClean()
      setSyncStatus('synced')
      return true
    } catch {
      setSyncStatus('error')
      return false
    }
  }, [exportRaw, persist])

  const pull = useCallback(async (): Promise<boolean> => {
    const config = getGitHubConfig()
    const password = getPassword()
    if (!config || !password) return false

    try {
      setSyncStatus('syncing')
      const remote = await getFile(config.repo, config.token)
      if (!remote) {
        setSyncStatus('synced')
        return false
      }

      // Skip if SHA hasn't changed
      if (_remoteSha && _remoteSha === remote.sha) {
        setSyncStatus('synced')
        return false
      }

      const bytes = await decrypt(remote.data, password)
      await importRaw(bytes)
      _remoteSha = remote.sha
      reloadAllStores()

      const currentDb = getDb()
      if (currentDb) {
        setSetting(currentDb, 'last_sync_time', new Date().toISOString())
        await persist()
      }
      markClean()
      setSyncStatus('synced')
      return true
    } catch {
      setSyncStatus('error')
      return false
    }
  }, [importRaw, persist])

  // Initial sync — pull existing DB or push empty one for first commit
  const initialSync = useCallback(async (): Promise<boolean> => {
    const config = getGitHubConfig()
    const password = getPassword()
    if (!config || !password) return false

    try {
      setSyncStatus('syncing')
      const remote = await getFile(config.repo, config.token)

      if (remote) {
        const bytes = await decrypt(remote.data, password)
        await importRaw(bytes)
        _remoteSha = remote.sha
        reloadAllStores()
      } else {
        // First commit — push empty DB
        const bytes = exportRaw()
        if (!bytes) return false
        const encrypted = await encrypt(bytes, password)
        const sha = await putFile(config.repo, config.token, encrypted, null)
        _remoteSha = sha
      }

      const currentDb = getDb()
      if (currentDb) {
        setSetting(currentDb, 'last_sync_time', new Date().toISOString())
        await persist()
      }
      markClean()
      setSyncStatus('synced')
      return true
    } catch {
      setSyncStatus('error')
      return false
    }
  }, [exportRaw, importRaw, persist])

  // Auto-push after writes (debounced 60s)
  const schedulePush = useCallback(() => {
    if (!getGitHubConfig()) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      push()
    }, 60_000)
  }, [push])

  return {
    // Manual
    exportEncrypted,
    exportPlain,
    importFile,
    // GitHub sync
    push,
    pull,
    initialSync,
    schedulePush,
    syncStatus,
    isGitHubConfigured,
  }
}
