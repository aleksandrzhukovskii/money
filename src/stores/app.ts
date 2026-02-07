import { create } from 'zustand'
import type { Database } from 'sql.js'

interface AppState {
  db: Database | null
  setDb: (db: Database) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  setDb: (db) => set({ db }),
}))
