import { toISODate } from './format'

/** Lee un CSV respetando comillas; detecta coma, punto y coma o tabulador. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const first = clean.split('\n')[0] ?? ''
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Fechas comunes en estados de cuenta de México: 05/10/2026, 2026-10-05, 05-OCT-2026, 05 oct 26. */
export function parseDate(raw: string): string | undefined {
  const s = raw.trim().toLowerCase()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return toISODate(new Date(+m[1], +m[2] - 1, +m[3]))
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return +m[2] <= 12 ? toISODate(new Date(y, +m[2] - 1, +m[1])) : undefined
  }
  m = s.match(/^(\d{1,2})[-/. ]+([a-zé]{3})[a-zé]*\.?[-/. ]+(\d{2,4})/)
  if (m) {
    const idx = Math.max(MONTHS.indexOf(m[2]), MONTHS_EN.indexOf(m[2]))
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return idx >= 0 ? toISODate(new Date(y, idx, +m[1])) : undefined
  }
  return undefined
}

/** "$1,234.50", "-1234.5", "(1,234.50)" → centavos con signo. */
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const negative = /^\(.*\)$/.test(s) || /-/.test(s)
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) return undefined
  return Math.round(n * 100) * (negative ? -1 : 1)
}

export interface ColumnMap {
  date: number
  description: number
  /** Columna con monto con signo, o -1 si se usan cargo/abono. */
  amount: number
  charge: number
  credit: number
}

const find = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h.toLowerCase()))

export function guessColumns(headers: string[]): ColumnMap {
  return {
    date: Math.max(0, find(headers, /fecha|date/)),
    description: find(headers, /descrip|concepto|detalle|movimiento|referencia|establecimiento|description/),
    amount: find(headers, /^monto|importe|amount|cantidad/),
    charge: find(headers, /cargo|retiro|d[eé]bito|egreso/),
    credit: find(headers, /abono|dep[oó]sito|cr[eé]dito|ingreso/),
  }
}

export interface ImportRow {
  date: string
  description: string
  /** Positivo = ingreso, negativo = gasto. */
  amount: number
}

export function mapRows(rows: string[][], map: ColumnMap, invert: boolean): ImportRow[] {
  const out: ImportRow[] = []
  for (const r of rows) {
    const date = parseDate(r[map.date] ?? '')
    if (!date) continue
    let amount: number | undefined
    if (map.amount >= 0) amount = parseAmount(r[map.amount] ?? '')
    else {
      const charge = Math.abs(parseAmount(r[map.charge] ?? '') ?? 0)
      const credit = Math.abs(parseAmount(r[map.credit] ?? '') ?? 0)
      amount = credit - charge
    }
    if (!amount) continue
    out.push({ date, description: (map.description >= 0 ? r[map.description] : '') ?? '', amount: invert ? -amount : amount })
  }
  return out
}
