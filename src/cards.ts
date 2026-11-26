import { ACCOUNT_TYPES, type Account, type CardBrand } from './db'

/** Detecta la marca por los primeros dígitos (BIN). */
export function detectBrand(digits: string): CardBrand | undefined {
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^(506|5888|6\d)/.test(digits)) return 'carnet'
  return digits.length >= 4 ? 'other' : undefined
}

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  amex: 'AMEX',
  carnet: 'Carnet',
  other: 'Tarjeta',
}

/** "4123456787" → "4123 4567 87" (Amex usa 4-6-5). */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const amex = /^3[47]/.test(digits)
  const max = amex ? 15 : 16
  const d = digits.slice(0, max)
  const groups = amex ? [4, 6, 5] : [4, 4, 4, 4]
  const parts: string[] = []
  let i = 0
  for (const g of groups) {
    if (i >= d.length) break
    parts.push(d.slice(i, i + g))
    i += g
  }
  return parts.join(' ')
}

/** Escribe el vencimiento como MM/AA conforme se teclea. */
export function formatExpiry(raw: string, prev = ''): string {
  let d = raw.replace(/\D/g, '').slice(0, 4)
  // Al borrar la diagonal se borra también el dígito anterior.
  if (prev.endsWith('/') && raw.length < prev.length) d = d.slice(0, -1)
  if (d.length === 1 && Number(d) > 1) d = `0${d}`
  if (d.length >= 2) {
    const mm = Math.min(Math.max(Number(d.slice(0, 2)), 1), 12)
    return `${String(mm).padStart(2, '0')}/${d.slice(2)}`
  }
  return d
}

export function validExpiry(v: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(v)
}

/** Degradado del color de la cuenta, como el plástico de una tarjeta. */
export function cardBackground(color: string): string {
  return `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 62%, #000) 100%)`
}

export function cardLabel(a: Account): string {
  return a.brand ? BRAND_LABELS[a.brand] : ACCOUNT_TYPES[a.type]
}
