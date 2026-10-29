import { db, newId, type Recurring, type RecurringFrequency } from './db'
import { toISODate, todayISO } from './format'

export const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()
const clampDate = (y: number, m: number, d: number) => {
  const date = new Date(y, m - 1, 1)
  return toISODate(new Date(date.getFullYear(), date.getMonth(), Math.min(d, lastDay(date.getFullYear(), date.getMonth() + 1))))
}

/** Siguiente fecha según la frecuencia. Quincenal alterna entre la primera y la segunda quincena. */
export function addPeriod(iso: string, freq: RecurringFrequency, anchorDay: number): string {
  const { y, m, d } = parse(iso)
  switch (freq) {
    case 'weekly':
      return toISODate(new Date(y, m - 1, d + 7))
    case 'biweekly':
      return d <= 15 ? clampDate(y, m, d + 15) : clampDate(y, m + 1, d - 15)
    case 'monthly':
      return clampDate(y, m + 1, anchorDay)
    case 'yearly':
      return clampDate(y + 1, m, anchorDay)
  }
}

/** Registra los movimientos recurrentes que ya vencieron. Devuelve cuántos creó. */
export async function materializeRecurring(): Promise<number> {
  const today = todayISO()
  let created = 0
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    const due = await db.recurring.where('nextDate').belowOrEqual(today).toArray()
    for (const r of due) {
      if (!r.active) continue
      let next = r.nextDate
      // Tope de seguridad por si la app no se abrió en mucho tiempo.
      for (let i = 0; next <= today && i < 120; i++) {
        if (r.endDate && next > r.endDate) break
        if (r.auto === false) {
          next = addPeriod(next, r.frequency, r.anchorDay)
          continue
        }
        await db.transactions.add({
          id: newId(),
          type: r.type,
          amount: r.amount,
          accountId: r.accountId,
          toAccountId: r.toAccountId,
          categoryId: r.categoryId,
          date: next,
          note: r.note,
          createdAt: Date.now(),
          recurringId: r.id,
        })
        created++
        next = addPeriod(next, r.frequency, r.anchorDay)
      }
      await db.recurring.update(r.id, { nextDate: next, active: !(r.endDate && next > r.endDate) })
    }
  })
  return created
}

/** Crea la regla a partir del primer movimiento: la siguiente fecha es un periodo después. */
export function recurringFrom(fields: Omit<Recurring, 'id' | 'anchorDay' | 'active' | 'nextDate'>, firstDate: string): Recurring {
  const anchorDay = parse(firstDate).d
  return { ...fields, id: newId(), anchorDay, nextDate: addPeriod(firstDate, fields.frequency, anchorDay), active: true, startDate: firstDate }
}

/** Fechas de pago de una regla entre dos fechas (inclusive), respetando su fin. */
export function occurrences(r: Recurring, from: string, to: string, limit = 400): string[] {
  const out: string[] = []
  let d = r.nextDate
  for (let i = 0; d <= to && i < limit; i++) {
    if (r.endDate && d > r.endDate) break
    if (d >= from) out.push(d)
    d = addPeriod(d, r.frequency, r.anchorDay)
  }
  return out
}

/** Fecha del pago número n contando desde el inicio (n = 1 es el inicio). */
export function nthDate(start: string, freq: RecurringFrequency, n: number): string {
  const anchor = parse(start).d
  let d = start
  for (let i = 1; i < n; i++) d = addPeriod(d, freq, anchor)
  return d
}

/** Pagos que faltan; null si no tiene fin. */
export function remainingPayments(r: Recurring): number | null {
  if (!r.endDate) return null
  return r.active ? occurrences(r, r.nextDate, r.endDate).length : 0
}

/** Primera fecha de pago desde hoy, para no registrar pagos pasados al crear un plan que ya había empezado. */
export function firstFrom(start: string, freq: RecurringFrequency, anchorDay: number, today: string): string {
  let d = start
  for (let i = 0; d < today && i < 2000; i++) d = addPeriod(d, freq, anchorDay)
  return d
}
