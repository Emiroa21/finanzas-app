const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export const formatMoney = (cents: number) => money.format(cents / 100)

/** Convierte texto como "1,234.5" a centavos. */
export function parseToCents(text: string): number {
  const n = Number.parseFloat(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, '')

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISODate(new Date())
export const monthOf = (iso: string) => iso.slice(0, 7)
export const currentMonth = () => monthOf(todayISO())

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function dayLabel(iso: string): string {
  const today = todayISO()
  const yesterday = toISODate(new Date(Date.now() - 864e5))
  if (iso === today) return 'Hoy'
  if (iso === yesterday) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
