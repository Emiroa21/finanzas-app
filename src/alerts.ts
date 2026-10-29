import { cardStatus } from './credit'
import { toISODate, todayISO } from './format'
import type { AppData } from './hooks'

export interface Alert {
  id: string
  icon: string
  title: string
  detail: string
  amount?: number
  date?: string
  tone: 'info' | 'warn' | 'danger'
}

const inDays = (n: number) => toISODate(new Date(Date.now() + n * 864e5))

/** Avisos para Inicio: cobros próximos, pagos de tarjeta, deudas y respaldo. */
export function buildAlerts(data: AppData, lastBackup: number | null): Alert[] {
  const today = todayISO()
  const week = inDays(7)
  const alerts: Alert[] = []

  for (const card of data.accounts) {
    if (card.archived) continue
    const st = cardStatus(card, data.transactions, today)
    if (!st || st.payNoInterest <= 0 || st.due > inDays(10)) continue
    alerts.push({
      id: `card-${card.id}`,
      icon: '💳',
      title: `Pagar ${card.name}`,
      detail: st.due < today ? 'Fecha de pago vencida' : 'Para no generar intereses',
      amount: st.payNoInterest,
      date: st.due,
      tone: st.due < today ? 'danger' : 'warn',
    })
  }

  for (const r of data.recurring) {
    if (!r.active || r.type !== 'expense' || r.nextDate > week) continue
    const c = data.categoryById.get(r.categoryId ?? '')
    alerts.push({ id: `rec-${r.id}`, icon: c?.icon ?? '🔁', title: r.note || c?.name || 'Pago recurrente', detail: 'Se registrará automáticamente', amount: r.amount, date: r.nextDate, tone: 'info' })
  }

  for (const d of data.debts) {
    const paid = d.payments.reduce((s, p) => s + p.amount, 0)
    if (!d.dueDate || paid >= d.amount || d.dueDate > week) continue
    alerts.push({
      id: `debt-${d.id}`,
      icon: d.direction === 'owe' ? '🤝' : '📥',
      title: d.direction === 'owe' ? `Pagarle a ${d.person}` : `Cobrarle a ${d.person}`,
      detail: d.dueDate < today ? 'Fecha vencida' : 'Fecha acordada',
      amount: d.amount - paid,
      date: d.dueDate,
      tone: d.dueDate < today ? 'danger' : 'warn',
    })
  }

  alerts.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  const days = lastBackup ? (Date.now() - lastBackup) / 864e5 : Infinity
  if (data.transactions.length >= 5 && days > 7) {
    alerts.unshift({
      id: 'backup',
      icon: '💾',
      title: lastBackup ? `Tu último respaldo fue hace ${Math.floor(days)} días` : 'Aún no tienes respaldo',
      detail: 'Guárdalo en iCloud Drive desde Cuentas → Respaldo',
      tone: 'warn',
    })
  }
  return alerts
}
