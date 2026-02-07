import { create } from 'zustand'
import type { SpendingType } from '@/types/database'
import { getSpendingTypes, insertSpendingType, updateSpendingType, deleteSpendingType, getMonthlySpending } from '@/db/queries/spendingTypes'
import type { Database } from 'sql.js'

interface SpendingTypesState {
  items: SpendingType[]
  monthlySpent: Record<number, number>
  load: (db: Database) => void
  add: (db: Database, data: { name: string; currency: string; icon?: string; color?: string }) => number
  update: (db: Database, id: number, data: Partial<Pick<SpendingType, 'name' | 'currency' | 'icon' | 'color' | 'is_active' | 'sort_order'>>) => void
  remove: (db: Database, id: number) => void
}

export const useSpendingTypesStore = create<SpendingTypesState>((set) => ({
  items: [],
  monthlySpent: {},
  load: (db) => {
    set({ items: getSpendingTypes(db), monthlySpent: getMonthlySpending(db) })
  },
  add: (db, data) => {
    const id = insertSpendingType(db, data)
    set({ items: getSpendingTypes(db), monthlySpent: getMonthlySpending(db) })
    return id
  },
  update: (db, id, data) => {
    updateSpendingType(db, id, data)
    set({ items: getSpendingTypes(db), monthlySpent: getMonthlySpending(db) })
  },
  remove: (db, id) => {
    deleteSpendingType(db, id)
    set({ items: getSpendingTypes(db), monthlySpent: getMonthlySpending(db) })
  },
}))
