import { create } from 'zustand'
import type { Income } from '@/types/database'
import { getIncomes, insertIncome, updateIncome, deleteIncome, getMonthlyEarnings, mergeIncome, reorderIncomes } from '@/db/queries/incomes'
import type { Database } from 'sql.js'

interface IncomesState {
  items: Income[]
  monthlyEarned: Record<number, number>
  load: (db: Database) => void
  add: (db: Database, data: { name: string; currency: string; expected_amount?: number; icon?: string; color?: string }) => number
  update: (db: Database, id: number, data: Partial<Pick<Income, 'name' | 'currency' | 'expected_amount' | 'icon' | 'color' | 'is_active' | 'sort_order'>>) => void
  remove: (db: Database, id: number) => void
  merge: (db: Database, sourceId: number, targetId: number) => void
  reorder: (db: Database, orderedIds: number[]) => void
}

export const useIncomesStore = create<IncomesState>((set) => ({
  items: [],
  monthlyEarned: {},
  load: (db) => {
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
  },
  add: (db, data) => {
    const id = insertIncome(db, data)
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
    return id
  },
  update: (db, id, data) => {
    updateIncome(db, id, data)
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
  },
  remove: (db, id) => {
    deleteIncome(db, id)
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
  },
  merge: (db, sourceId, targetId) => {
    mergeIncome(db, sourceId, targetId)
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
  },
  reorder: (db, orderedIds) => {
    reorderIncomes(db, orderedIds)
    set({ items: getIncomes(db), monthlyEarned: getMonthlyEarnings(db) })
  },
}))
