import { create } from 'zustand'
import type { Database } from 'sql.js'

type ToastPosition = 'top-center' | 'bottom-center'

interface AppState {
  db: Database | null
  setDb: (db: Database) => void
  compactAmounts: boolean
  setCompactAmounts: (v: boolean) => void
  toastPosition: ToastPosition
  setToastPosition: (v: ToastPosition) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  setDb: (db) => set({ db }),
  compactAmounts: localStorage.getItem('compact_amounts') === 'true',
  setCompactAmounts: (v) => {
    localStorage.setItem('compact_amounts', v ? 'true' : 'false')
    set({ compactAmounts: v })
  },
  toastPosition: (localStorage.getItem('toast_position') as ToastPosition) || 'top-center',
  setToastPosition: (v) => {
    localStorage.setItem('toast_position', v)
    set({ toastPosition: v })
  },
}))
