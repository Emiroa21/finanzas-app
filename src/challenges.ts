import type { Challenge, ChallengeKind, Goal } from './db'

export const CHALLENGES: Record<ChallengeKind, { name: string; icon: string; desc: string; cells: number; base: number; weekly: boolean }> = {
  'weekly-up': { name: '52 semanas', icon: '📅', desc: 'Cada semana ahorras un poco más: semana 1 el monto base, semana 2 el doble…', cells: 52, base: 1000, weekly: true },
  'weekly-down': { name: '52 semanas al revés', icon: '🔁', desc: 'Empiezas con la semana más alta y cada vez es más fácil. Ideal en temporada de aguinaldo.', cells: 52, base: 1000, weekly: true },
  envelopes: { name: '100 sobres', icon: '✉️', desc: '100 sobres numerados: elige cualquiera cuando puedas y ahorra su número por el monto base.', cells: 100, base: 1000, weekly: false },
  fixed: { name: 'Fijo semanal', icon: '🪙', desc: 'La misma cantidad cada semana durante un año.', cells: 52, base: 20000, weekly: true },
}

export function cellAmount(c: Challenge, i: number): number {
  const n = CHALLENGES[c.kind].cells
  if (c.kind === 'weekly-up' || c.kind === 'envelopes') return c.base * (i + 1)
  if (c.kind === 'weekly-down') return c.base * (n - i)
  return c.base
}

export function challengeTotal(kind: ChallengeKind, base: number): number {
  const c = { kind, base, start: '' }
  let total = 0
  for (let i = 0; i < CHALLENGES[kind].cells; i++) total += cellAmount(c, i)
  return total
}

/** Casillas marcadas, guardadas como aportaciones con nota "reto:N". */
export function doneCells(g: Goal): Set<number> {
  const done = new Set<number>()
  for (const m of g.moves) {
    const match = /^reto:(\d+)$/.exec(m.note ?? '')
    if (match) done.add(Number(match[1]))
  }
  return done
}

/** Semana del reto que corresponde a hoy (0 = primera), o null si no es semanal. */
export function currentWeek(c: Challenge, today: string): number | null {
  if (!CHALLENGES[c.kind].weekly) return null
  const days = (Date.parse(today) - Date.parse(c.start)) / 864e5
  return Math.max(0, Math.min(CHALLENGES[c.kind].cells - 1, Math.floor(days / 7)))
}
