import { centsToInput, currentMonth, formatMoney, parseToCents, shiftMonth } from '../format'
import { monthTotals, useStoredState, type AppData } from '../hooks'
import { FREQUENCIES, project, requiredContribution, type Frequency, type ProjectionPoint } from '../projection'

type Mode = 'grow' | 'goal'

interface Form {
  mode: Mode
  initial: string
  contribution: string
  goal: string
  frequency: Frequency
  term: string
  termUnit: 'months' | 'years'
  rate: string
}

const DEFAULTS: Form = { mode: 'grow', initial: '', contribution: '1000', goal: '50000', frequency: 'monthly', term: '1', termUnit: 'years', rate: '0' }

export function Projection({ data }: { data: AppData }) {
  const [form, setForm] = useStoredState<Form>('projectionForm', DEFAULTS)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value })

  const months = Math.min(600, Math.max(1, Math.round((Number.parseFloat(form.term) || 0) * (form.termUnit === 'years' ? 12 : 1))))
  const annualRate = Math.max(0, Number.parseFloat(form.rate) || 0)
  const base = { initial: parseToCents(form.initial), frequency: form.frequency, months, annualRate }
  const goal = parseToCents(form.goal)
  const contribution = form.mode === 'goal' ? requiredContribution(goal, base) : parseToCents(form.contribution)
  const result = project({ ...base, contribution })
  const withoutRate = annualRate > 0 ? project({ ...base, contribution, annualRate: 0 }).final : null
  const freqLabel = FREQUENCIES[form.frequency].label.toLowerCase()

  // Ahorro real: promedio de ingresos menos gastos de los últimos 3 meses completos.
  const lastMonths = [1, 2, 3].map((i) => monthTotals(data.transactions, shiftMonth(currentMonth(), -i)))
  const withData = lastMonths.filter((m) => m.income > 0 || m.expense > 0)
  const avgSaving = withData.length ? Math.round(withData.reduce((s, m) => s + m.income - m.expense, 0) / withData.length) : 0

  return (
    <>
      <div className="segmented two">
        <button className={form.mode === 'grow' ? 'on' : ''} onClick={() => set('mode', 'grow')}>
          ¿Cuánto juntaré?
        </button>
        <button className={form.mode === 'goal' ? 'on' : ''} onClick={() => set('mode', 'goal')}>
          ¿Cuánto debo ahorrar?
        </button>
      </div>

      <section className="card">
        <div className="form-list flat">
          <label className="form-row">
            <span>Ya tengo ahorrado</span>
            <input inputMode="decimal" placeholder="$0" value={form.initial} onChange={(e) => set('initial', e.target.value)} />
          </label>
          {form.mode === 'grow' ? (
            <label className="form-row">
              <span>Voy a ahorrar</span>
              <input inputMode="decimal" placeholder="$0" value={form.contribution} onChange={(e) => set('contribution', e.target.value)} />
            </label>
          ) : (
            <label className="form-row">
              <span>Quiero juntar</span>
              <input inputMode="decimal" placeholder="$0" value={form.goal} onChange={(e) => set('goal', e.target.value)} />
            </label>
          )}
          <label className="form-row">
            <span>Cada cuándo</span>
            <select value={form.frequency} onChange={(e) => set('frequency', e.target.value as Frequency)}>
              {Object.entries(FREQUENCIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <span>Durante</span>
            <span className="inline-inputs">
              <input inputMode="decimal" value={form.term} onChange={(e) => set('term', e.target.value)} aria-label="Plazo" />
              <select value={form.termUnit} onChange={(e) => set('termUnit', e.target.value as Form['termUnit'])} aria-label="Unidad">
                <option value="months">meses</option>
                <option value="years">años</option>
              </select>
            </span>
          </div>
          <label className="form-row">
            <span>Rendimiento anual (%)</span>
            <input inputMode="decimal" placeholder="0" value={form.rate} onChange={(e) => set('rate', e.target.value)} />
          </label>
        </div>
        <p className="hint">Pon 0 si lo guardas sin invertir. Si lo metes a una cuenta que paga intereses (por ejemplo CETES), escribe la tasa anual que te ofrecen.</p>
        {form.mode === 'grow' && avgSaving > 0 && (
          <button className="secondary-btn suggest" onClick={() => setForm({ ...form, contribution: centsToInput(avgSaving), frequency: 'monthly' })}>
            Usar mi ahorro real: {formatMoney(avgSaving)} al mes
          </button>
        )}
      </section>

      <section className="card">
        {form.mode === 'goal' && (
          <div className="goal-answer">
            {contribution === 0 ? (
              <span>Con lo que ya tienes alcanzas la meta.</span>
            ) : (
              <>
                <span className="muted">Necesitas ahorrar</span>
                <strong>{formatMoney(contribution)}</strong>
                <span className="muted">{freqLabel}</span>
              </>
            )}
          </div>
        )}
        <span className="muted">En {months % 12 === 0 ? `${months / 12} ${months === 12 ? 'año' : 'años'}` : `${months} ${months === 1 ? 'mes' : 'meses'}`} tendrás</span>
        <div className="hero-amount">{formatMoney(result.final)}</div>
        <div className="stats">
          <div>
            <span className="muted">Aportado</span>
            <strong>{formatMoney(result.contributed)}</strong>
          </div>
          <div>
            <span className="muted">Rendimiento</span>
            <strong className="income">{formatMoney(result.interest)}</strong>
          </div>
          <div>
            <span className="muted">Por mes</span>
            <strong>{formatMoney(Math.round((contribution * FREQUENCIES[form.frequency].perYear) / 12))}</strong>
          </div>
        </div>
        {withoutRate !== null && <p className="hint">Sin rendimiento juntarías {formatMoney(withoutRate)}.</p>}
        <GrowthChart points={result.points} />
      </section>

      {months >= 24 && (
        <section className="card">
          <div className="card-title">
            <span>Año por año</span>
          </div>
          <table className="year-table">
            <thead>
              <tr>
                <th>Año</th>
                <th>Aportado</th>
                <th>Rendimiento</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.points
                .filter((p) => p.month > 0 && (p.month % 12 === 0 || p.month === months))
                .map((p) => (
                  <tr key={p.month}>
                    <td>{p.month % 12 === 0 ? p.month / 12 : (p.month / 12).toFixed(1)}</td>
                    <td>{formatMoney(Math.round(p.contributed)).replace(/\.\d\d$/, '')}</td>
                    <td className="income">{formatMoney(Math.round(p.balance - p.contributed)).replace(/\.\d\d$/, '')}</td>
                    <td>
                      <strong>{formatMoney(Math.round(p.balance)).replace(/\.\d\d$/, '')}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

/** Área de lo aportado y línea del saldo total a lo largo del plazo. */
function GrowthChart({ points }: { points: ProjectionPoint[] }) {
  if (points.length < 2) return null
  const W = 320
  const H = 150
  const pad = { l: 4, r: 4, t: 10, b: 20 }
  const last = points[points.length - 1]
  const maxY = Math.max(1, ...points.map((p) => p.balance))
  const x = (m: number) => pad.l + (m / last.month) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b)
  const line = (key: 'balance' | 'contributed') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)} ${y(p[key]).toFixed(1)}`).join('')
  const area = (key: 'balance' | 'contributed') => `${line(key)}L${x(last.month)} ${y(0)}L${x(0)} ${y(0)}Z`
  const ticks = last.month >= 24 ? Array.from({ length: Math.floor(last.month / 12) + 1 }, (_, i) => i * 12) : [0, last.month]
  const step = Math.ceil(ticks.length / 6)

  return (
    <figure className="growth">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Crecimiento del ahorro hasta ${formatMoney(last.balance)}`}>
        <path d={area('balance')} className="area-interest" />
        <path d={area('contributed')} className="area-contributed" />
        <path d={line('balance')} className="line-balance" />
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="axis" />
        {ticks
          .filter((_, i) => i % step === 0)
          .map((m) => (
            <text key={m} x={x(m)} y={H - 4} textAnchor={m === 0 ? 'start' : m === last.month ? 'end' : 'middle'} className="tick">
              {last.month >= 24 ? `${m / 12}a` : `${m}m`}
            </text>
          ))}
      </svg>
      <figcaption className="legend-inline">
        <span className="dot contributed-bg" /> Aportado <span className="dot income-bg" /> Rendimiento
      </figcaption>
    </figure>
  )
}
