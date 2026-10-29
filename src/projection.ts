export type Frequency = 'weekly' | 'biweekly' | 'monthly'

export const FREQUENCIES: Record<Frequency, { label: string; perYear: number }> = {
  weekly: { label: 'Semanal', perYear: 52 },
  biweekly: { label: 'Quincenal', perYear: 24 },
  monthly: { label: 'Mensual', perYear: 12 },
}

export interface ProjectionInput {
  /** Centavos que ya tienes ahorrados. */
  initial: number
  /** Centavos que aportas cada periodo. */
  contribution: number
  frequency: Frequency
  months: number
  /** Rendimiento anual en porcentaje (ej. 10 = 10% anual). */
  annualRate: number
}

export interface ProjectionPoint {
  month: number
  balance: number
  contributed: number
}

export interface ProjectionResult {
  final: number
  contributed: number
  interest: number
  points: ProjectionPoint[]
}

const periodsFor = (months: number, f: Frequency) => Math.round((months * FREQUENCIES[f].perYear) / 12)
const rateFor = (annualRate: number, f: Frequency) => annualRate / 100 / FREQUENCIES[f].perYear

/**
 * Simula el ahorro periodo a periodo: el saldo genera rendimiento y al final
 * de cada periodo se suma la aportación. Devuelve un punto por mes para graficar.
 */
export function project({ initial, contribution, frequency, months, annualRate }: ProjectionInput): ProjectionResult {
  const periods = periodsFor(months, frequency)
  const r = rateFor(annualRate, frequency)
  const perMonth = FREQUENCIES[frequency].perYear / 12
  let balance = initial
  let contributed = initial
  const points: ProjectionPoint[] = [{ month: 0, balance, contributed }]
  for (let k = 1; k <= periods; k++) {
    balance = balance * (1 + r) + contribution
    contributed += contribution
    const month = Math.min(months, Math.round(k / perMonth))
    if (month > points[points.length - 1].month) points.push({ month, balance, contributed })
  }
  const final = Math.round(balance)
  return { final, contributed: Math.round(contributed), interest: final - Math.round(contributed), points }
}

/** Aportación por periodo necesaria para juntar `goal` centavos en el plazo. */
export function requiredContribution(goal: number, input: Omit<ProjectionInput, 'contribution'>): number {
  const n = periodsFor(input.months, input.frequency)
  if (n <= 0) return 0
  const r = rateFor(input.annualRate, input.frequency)
  const grown = input.initial * (1 + r) ** n
  const missing = goal - grown
  if (missing <= 0) return 0
  const pmt = r === 0 ? missing / n : (missing * r) / ((1 + r) ** n - 1)
  return Math.ceil(pmt)
}
