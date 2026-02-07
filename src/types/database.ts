export interface Currency {
  code: string
  name: string
  fetched_at: string
}

export interface Income {
  id: number
  name: string
  currency: string
  expected_amount: number
  icon: string
  color: string
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Budget {
  id: number
  name: string
  currency: string
  icon: string
  color: string
  initial_balance: number
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BudgetWithBalance extends Budget {
  current_balance: number
}

export interface SpendingType {
  id: number
  name: string
  currency: string
  icon: string
  color: string
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Tag {
  id: number
  name: string
  color: string
  created_at: string
}

export type TransactionType = 'earning' | 'spending' | 'transfer'

export interface Transaction {
  id: number
  type: TransactionType
  source_income_id: number | null
  source_budget_id: number | null
  destination_budget_id: number | null
  destination_spending_type_id: number | null
  amount: number
  source_currency: string
  converted_amount: number | null
  destination_currency: string | null
  exchange_rate: number | null
  date: string
  comment: string
  created_at: string
  updated_at: string
}

export interface TransactionWithDetails extends Transaction {
  source_name: string
  destination_name: string
  tags: string[]
}

export interface ExchangeRate {
  id: number
  base_currency: string
  target_currency: string
  rate: number
  date: string
  fetched_at: string
}

export interface Setting {
  key: string
  value: string
}
