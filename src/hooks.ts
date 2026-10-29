import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { computeBalances, db, type Account, type Budget, type Category, type Debt, type Goal, type Recurring, type Transaction } from './db'

export interface AppData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  recurring: Recurring[]
  goals: Goal[]
  debts: Debt[]
  balances: Map<string, number>
  accountById: Map<string, Account>
  categoryById: Map<string, Category>
}

/** Todas las tablas en vivo; se vuelven a leer solas cuando cambian. */
export function useData(): AppData | undefined {
  const accounts = useLiveQuery(() => db.accounts.orderBy('type').toArray())
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray())
  const budgets = useLiveQuery(() => db.budgets.toArray())
  const recurring = useLiveQuery(() => db.recurring.orderBy('nextDate').toArray())
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray())
  const debts = useLiveQuery(() => db.debts.orderBy('createdAt').toArray())

  return useMemo(() => {
    if (!accounts || !categories || !transactions || !budgets || !recurring || !goals || !debts) return undefined
    return {
      accounts,
      categories,
      transactions,
      budgets,
      recurring,
      goals,
      debts,
      balances: computeBalances(accounts, transactions),
      accountById: new Map(accounts.map((a) => [a.id, a])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
    }
  }, [accounts, categories, transactions, budgets, recurring, goals, debts])
}

/** Estado que se recuerda entre aperturas (solo preferencias, nunca datos). */
export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* sin almacenamiento disponible */
    }
  }
  return [value, set]
}

export interface MonthTotals {
  income: number
  expense: number
  byCategory: Map<string, number>
}

export function monthTotals(transactions: Transaction[], month: string): MonthTotals {
  let income = 0
  let expense = 0
  const byCategory = new Map<string, number>()
  for (const t of transactions) {
    if (!t.date.startsWith(month)) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') {
      expense += t.amount
      const key = t.categoryId ?? ''
      byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount)
    }
  }
  return { income, expense, byCategory }
}
