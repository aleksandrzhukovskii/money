import { create } from 'zustand'
import type { Budget, BudgetWithBalance } from '@/types/database'
import { getBudgets, getBudgetsWithBalances, insertBudget, updateBudget, deleteBudget } from '@/db/queries/budgets'
import type { Database } from 'sql.js'

interface BudgetsState {
  items: Budget[]
  itemsWithBalances: BudgetWithBalance[]
  load: (db: Database) => void
  add: (db: Database, data: { name: string; currency: string; initial_balance?: number; icon?: string; color?: string }) => number
  update: (db: Database, id: number, data: Partial<Pick<Budget, 'name' | 'currency' | 'initial_balance' | 'icon' | 'color' | 'is_active' | 'sort_order'>>) => void
  remove: (db: Database, id: number) => void
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  items: [],
  itemsWithBalances: [],
  load: (db) => {
    set({
      items: getBudgets(db),
      itemsWithBalances: getBudgetsWithBalances(db),
    })
  },
  add: (db, data) => {
    const id = insertBudget(db, data)
    set({ items: getBudgets(db), itemsWithBalances: getBudgetsWithBalances(db) })
    return id
  },
  update: (db, id, data) => {
    updateBudget(db, id, data)
    set({ items: getBudgets(db), itemsWithBalances: getBudgetsWithBalances(db) })
  },
  remove: (db, id) => {
    deleteBudget(db, id)
    set({ items: getBudgets(db), itemsWithBalances: getBudgetsWithBalances(db) })
  },
}))
