import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  /** True when local writes exist that have not reached GitHub yet. */
  pending: boolean
  /** Timestamp of the last successful push/pull, used to confirm the write landed. */
  lastSyncedAt: number | null
  error: string | null
  setStatus: (status: SyncStatus) => void
  setPending: (pending: boolean) => void
  markSynced: () => void
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
  // Keep `pending` as-is on failure: the local changes are still unsynced.
  setError: (error) => set({ status: 'error', error }),
  reset: () => set({ status: 'idle', pending: false, lastSyncedAt: null, error: null }),
}))
