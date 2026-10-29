import { useState } from 'react'
import { MonthPicker } from '../components/MonthPicker'
import { currentMonth, formatMoney, monthLabel, shiftMonth } from '../format'
import { monthTotals, type AppData } from '../hooks'

export function Reports({ data }: { data: AppData }) {
  const [month, setMonth] = useState(currentMonth())
  const totals = monthTotals(data.transactions, month)
  const slices = [...totals.byCategory].sort((a, b) => b[1] - a[1])
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
  const history = months.map((m) => ({ m, ...monthTotals(data.transactions, m) }))
  const maxBar = Math.max(1, ...history.flatMap((h) => [h.income, h.expense]))

  return (
    <>
      <h1 className="title">Reportes</h1>
      <MonthPicker month={month} onChange={setMonth} />

      <section className="card">
        <div className="stats">
          <div>
            <span className="muted">Ingresos</span>
            <strong className="income">{formatMoney(totals.income)}</strong>
          </div>
          <div>
            <span className="muted">Gastos</span>
            <strong className="expense">{formatMoney(totals.expense)}</strong>
          </div>
          <div>
            <span className="muted">Balance</span>
            <strong>{formatMoney(totals.income - totals.expense)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <span>Gastos por categoría</span>
        </div>
        {slices.length === 0 ? (
          <p className="empty">Sin gastos en {monthLabel(month).toLowerCase()}.</p>
        ) : (
          <div className="donut-wrap">
            <Donut slices={slices.map(([id, v]) => ({ value: v, color: data.categoryById.get(id)?.color ?? '#8e8e93' }))} total={totals.expense} />
            <ul className="legend">
              {slices.map(([id, v]) => {
                const c = data.categoryById.get(id)
                return (
                  <li key={id}>
                    <span className="dot" style={{ background: c?.color ?? '#8e8e93' }} />
                    <span className="grow">
                      {c?.icon} {c?.name ?? 'Sin categoría'}
                    </span>
                    <span className="muted">{Math.round((v / totals.expense) * 100)}%</span>
                    <span>{formatMoney(v)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">
          <span>Últimos 6 meses</span>
          <span className="legend-inline">
            <span className="dot income-bg" /> Ingresos <span className="dot expense-bg" /> Gastos
          </span>
        </div>
        <div className="bars">
          {history.map((h) => (
            <div key={h.m} className={`bar-col ${h.m === month ? 'current' : ''}`}>
              <div className="bar-pair">
                <span className="bar income-bg" style={{ height: `${(h.income / maxBar) * 100}%` }} title={formatMoney(h.income)} />
                <span className="bar expense-bg" style={{ height: `${(h.expense / maxBar) * 100}%` }} title={formatMoney(h.expense)} />
              </div>
              <span className="bar-month">{monthLabel(h.m, true)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function Donut({ slices, total }: { slices: { value: number; color: string }[]; total: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`Gastos del mes: ${formatMoney(total)}`}>
      {slices.map((s, i) => {
        const len = (s.value / total) * circ
        const el = <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
        offset += len
        return el
      })}
      <text x="70" y="66" textAnchor="middle" className="donut-label">
        Total
      </text>
      <text x="70" y="84" textAnchor="middle" className="donut-value">
        {formatMoney(total).replace(/\.\d\d$/, '')}
      </text>
    </svg>
  )
}
