import Dexie, { type EntityTable } from 'dexie'

export type AccountType = 'cash' | 'debit' | 'credit' | 'savings' | 'investment'
export type TxType = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Saldo inicial en centavos. En tarjetas de crédito, la deuda va en negativo. */
  initialBalance: number
  color: string
  archived: boolean
  createdAt: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  kind: CategoryKind
  order: number
}

export interface Transaction {
  id: string
  type: TxType
  /** Monto en centavos, siempre positivo. */
  amount: number
  accountId: string
  /** Solo en transferencias. */
  toAccountId?: string
  /** Vacío en transferencias. */
  categoryId?: string
  /** Fecha local en formato AAAA-MM-DD. */
  date: string
  note: string
  createdAt: number
}

export interface Budget {
  id: string
  categoryId: string
  /** Límite mensual en centavos. */
  amount: number
}

export const db = new Dexie('finanzas') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  budgets: EntityTable<Budget, 'id'>
}

db.version(1).stores({
  accounts: 'id, type',
  categories: 'id, kind, order',
  transactions: 'id, date, accountId, toAccountId, categoryId, type',
  budgets: 'id, &categoryId',
})

export const newId = () => crypto.randomUUID()

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Tarjeta de crédito',
  savings: 'Ahorro',
  investment: 'Inversión',
}

export const COLORS = ['#148c5a', '#0a84ff', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#ac8e68', '#30d158', '#8e8e93']

const defaultCategories: [string, string, CategoryKind][] = [
  ['Comida', '🍽️', 'expense'],
  ['Súper', '🛒', 'expense'],
  ['Transporte', '🚌', 'expense'],
  ['Gasolina', '⛽', 'expense'],
  ['Hogar', '🏠', 'expense'],
  ['Servicios', '💡', 'expense'],
  ['Salud', '💊', 'expense'],
  ['Entretenimiento', '🎬', 'expense'],
  ['Compras', '🛍️', 'expense'],
  ['Suscripciones', '🔁', 'expense'],
  ['Educación', '📚', 'expense'],
  ['Otros gastos', '📦', 'expense'],
  ['Salario', '💼', 'income'],
  ['Freelance', '🧑‍💻', 'income'],
  ['Otros ingresos', '💰', 'income'],
]

db.on('populate', async (tx) => {
  await tx.table('categories').bulkAdd(
    defaultCategories.map(([name, icon, kind], i) => ({
      id: newId(),
      name,
      icon,
      kind,
      color: COLORS[i % COLORS.length],
      order: i,
    })),
  )
  const now = Date.now()
  await tx.table('accounts').bulkAdd([
    { id: newId(), name: 'Efectivo', type: 'cash', initialBalance: 0, color: COLORS[0], archived: false, createdAt: now },
    { id: newId(), name: 'Débito', type: 'debit', initialBalance: 0, color: COLORS[1], archived: false, createdAt: now + 1 },
  ])
})

/** Saldo actual por cuenta: saldo inicial más el efecto de cada movimiento. */
export function computeBalances(accounts: Account[], txs: Transaction[]): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.initialBalance]))
  const add = (id: string | undefined, delta: number) => {
    if (id && balances.has(id)) balances.set(id, balances.get(id)! + delta)
  }
  for (const t of txs) {
    if (t.type === 'income') add(t.accountId, t.amount)
    else if (t.type === 'expense') add(t.accountId, -t.amount)
    else {
      add(t.accountId, -t.amount)
      add(t.toAccountId, t.amount)
    }
  }
  return balances
}

/** Pide a Safari que no borre la base de datos cuando falte espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
