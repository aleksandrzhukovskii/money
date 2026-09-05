import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  /** True when local writes exist that have not reached GitHub yet. */
  pending: boolean
  /**
   * Timestamp of the last successful *push*, and nothing else. This is what
   * drives the "Synced" confirmation, whose only job is to tell you your changes
   * reached GitHub — so reads must never stamp it.
   */
  lastSyncedAt: number | null
  error: string | null
  setStatus: (status: SyncStatus) => void
  setPending: (pending: boolean) => void
  /** A push landed: confirm it. */
  markSynced: () => void
  /** A read finished with nothing to confirm — clears any previous error. */
  markIdle: () => void
  setError: (error: string) => void
  reset: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pending: false,
  lastSyncedAt: null,
  error: null,
  setStatus: (status) => set({ status }),
  setPending: (pending) => set({ pending }),
  markSynced: () => set({ status: 'synced', pending: false, lastSyncedAt: Date.now(), error: null }),
  markIdle: () => set({ status: 'idle', error: null }),
  // Keep `pending` as-is on failure: the local changes are still unsynced.
  setError: (error) => set({ status: 'error', error }),
  reset: () => set({ status: 'idle', pending: false, lastSyncedAt: null, error: null }),
}))
