import { closeIdb, resetDatabase } from '@/hooks/useDatabase'

/** Give up on a blocked IndexedDB deletion rather than hanging the caller. */
const DELETE_TIMEOUT_MS = 2000

function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, DELETE_TIMEOUT_MS)
    const done = () => { clearTimeout(timer); resolve() }
    try {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = done
      request.onerror = done
      // `blocked` means another connection is still open; the timeout covers it.
    } catch {
      done()
    }
  })
}

/**
 * Wipe every trace of the app from this device: credentials, database, caches
 * and the service worker. Used by "Use different account" and Logout so a stale
 * build or a half-migrated database can't survive into the next session.
 *
 * Callers should reload the page afterwards — the in-memory stores are not reset.
 */
export async function clearAllLocalData(): Promise<void> {
  resetDatabase()
  // Close our own connection first, otherwise the delete below is blocked by it.
  await closeIdb()

  try { localStorage.clear() } catch { /* storage disabled */ }
  try { sessionStorage.clear() } catch { /* storage disabled */ }

  try {
    // `databases()` is unavailable on older Safari — fall back to the known name.
    const known = await indexedDB.databases?.().catch(() => [])
    const names = (known ?? []).map((d) => d.name).filter((n): n is string => !!n)
    if (!names.includes('money-tracker')) names.push('money-tracker')
    await Promise.all(names.map(deleteIdb))
  } catch {
    await deleteIdb('money-tracker')
  }

  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch { /* Cache API unavailable */ }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
  } catch { /* no service worker */ }
}
