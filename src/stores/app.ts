import { create } from 'zustand'
import { getSetting, setSetting } from '@/db/queries/settings'
import type { Database } from 'sql.js'

type ToastPosition = 'top-center' | 'bottom-center'
export type CardSize = 'small' | 'medium' | 'large'

interface AppState {
  db: Database | null
  setDb: (db: Database) => void
  compactAmounts: boolean
  setCompactAmounts: (v: boolean) => void
  toastPosition: ToastPosition
  setToastPosition: (v: ToastPosition) => void
  cardSize: CardSize
  setCardSize: (v: CardSize) => void
  loadSettings: (db: Database) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  setDb: (db) => set({ db }),
  compactAmounts: false,
  setCompactAmounts: (v) => set({ compactAmounts: v }),
  toastPosition: 'top-center',
  setToastPosition: (v) => set({ toastPosition: v }),
  cardSize: 'large',
  setCardSize: (v) => set({ cardSize: v }),
  loadSettings: (db) => {
    // Migrate from localStorage if DB has no value yet
    function migrate(key: string): string | null {
      const dbVal = getSetting(db, key)
      if (dbVal !== null) return dbVal
      const lsVal = localStorage.getItem(key)
      if (lsVal !== null) {
        setSetting(db, key, lsVal)
        localStorage.removeItem(key)
        return lsVal
      }
      return null
    }

    const compact = migrate('compact_amounts')
    const toast = migrate('toast_position')
    const card = migrate('card_size')

    set({
      compactAmounts: compact === 'true',
      toastPosition: (toast as ToastPosition) || 'top-center',
      cardSize: (card as CardSize) || 'large',
    })
  },
}))
