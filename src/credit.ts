import type { Account, Transaction } from './db'
import { toISODate, todayISO } from './format'

export interface CardStatus {
  /** Fecha del último corte (AAAA-MM-DD). */
  cutoff: string
  /** Fecha límite de pago de ese corte. */
  due: string
  /** Lo que debes hoy, en centavos. */
  debt: number
  /** Lo que debías al corte. */
  debtAtCutoff: number
  /** Lo que falta pagar para no generar intereses en este periodo. */
  payNoInterest: number
  /** Parte de compras a MSI que aún no se cobra. */
  pendingInstallments: number
  /** Suma de mensualidades MSI vigentes. */
  monthlyInstallments: number
  available?: number
}

const cutDate = (y: number, m: number, day: number) => toISODate(new Date(y, m - 1, Math.min(day, new Date(y, m, 0).getDate())))

function lastCutoff(day: number, today: string): string {
  const [y, m] = today.split('-').map(Number)
  const thisMonth = cutDate(y, m, day)
  return thisMonth <= today ? thisMonth : cutDate(y, m - 1, day)
}

/** Primer corte en o después de una fecha. */
function firstCutoffFrom(day: number, iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const thisMonth = cutDate(y, m, day)
  return thisMonth >= iso ? thisMonth : cutDate(y, m + 1, day)
}

/** Primera fecha con el día de pago después del corte. */
function dueAfter(cutoff: string, dueDay: number): string {
  const [y, m] = cutoff.split('-').map(Number)
  const same = cutDate(y, m, dueDay)
  return same > cutoff ? same : cutDate(y, m + 1, dueDay)
}

const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

/** Efecto de un movimiento en el saldo de la tarjeta (negativo = más deuda). */
function effect(t: Transaction, id: string): number {
  if (t.type === 'income' && t.accountId === id) return t.amount
  if (t.type === 'expense' && t.accountId === id) return -t.amount
  if (t.type === 'transfer') return (t.toAccountId === id ? t.amount : 0) - (t.accountId === id ? t.amount : 0)
  return 0
}

export function cardStatus(card: Account, txs: Transaction[], today = todayISO()): CardStatus | null {
  if (card.type !== 'credit' || !card.cutoffDay || !card.dueDay) return null
  const cutoff = lastCutoff(card.cutoffDay, today)
  let balanceAtCutoff = card.initialBalance
  let balanceNow = card.initialBalance
  let paymentsAfter = 0
  let pendingInstallments = 0
  let monthlyInstallments = 0

  for (const t of txs) {
    const e = effect(t, card.id)
    if (!e) continue
    balanceNow += e
    if (t.date <= cutoff) balanceAtCutoff += e
    else if (e > 0) paymentsAfter += e

    if (t.installments && t.type === 'expense' && t.accountId === card.id && t.date <= cutoff) {
      const billed = Math.min(t.installments, monthsBetween(firstCutoffFrom(card.cutoffDay, t.date), cutoff) + 1)
      pendingInstallments += t.amount - Math.round((t.amount * billed) / t.installments)
      if (billed < t.installments) monthlyInstallments += Math.round(t.amount / t.installments)
    } else if (t.installments && t.type === 'expense' && t.accountId === card.id) {
      monthlyInstallments += Math.round(t.amount / t.installments)
    }
  }

  const debtAtCutoff = Math.max(0, -balanceAtCutoff)
  const debt = Math.max(0, -balanceNow)
  return {
    cutoff,
    due: dueAfter(cutoff, card.dueDay),
    debt,
    debtAtCutoff,
    payNoInterest: Math.max(0, debtAtCutoff - pendingInstallments - paymentsAfter),
    pendingInstallments,
    monthlyInstallments,
    available: card.creditLimit ? card.creditLimit - debt : undefined,
  }
}
