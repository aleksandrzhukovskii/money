import { create } from 'zustand'
import type { Database } from 'sql.js'

interface AppState {
  db: Database | null
  setDb: (db: Database) => void
  compactAmounts: boolean
  setCompactAmounts: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  setDb: (db) => set({ db }),
  compactAmounts: localStorage.getItem('compact_amounts') === 'true',
  setCompactAmounts: (v) => {
    localStorage.setItem('compact_amounts', v ? 'true' : 'false')
    set({ compactAmounts: v })
  },
}))
