import { useState } from 'react'
import { PaymentSheet } from '../components/PaymentSheet'
import type { Recurring } from '../db'
import { currentMonth, daysInMonth, formatMoney, monthLabel, shiftMonth, shortDate, todayISO } from '../format'
import type { AppData } from '../hooks'
import { FREQ_LABELS, occurrences, remainingPayments } from '../recurring'

const lastOf = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

export function Payments({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const today = todayISO()
  const month = currentMonth()
  const outgoing = data.recurring.filter((r) => r.active && r.type !== 'income')
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i))
  const perMonth = months.map((m) => ({
    m,
    total: outgoing.reduce((s, r) => s + occurrences(r, `${m}-01`, lastOf(m)).length * r.amount, 0),
  }))
  const leftThisMonth = outgoing.reduce((s, r) => s + occurrences(r, today, lastOf(month)).length * r.amount, 0)
  const max = Math.max(1, ...perMonth.map((p) => p.total))
  const running = data.recurring.filter((r) => r.active)
  const stopped = data.recurring.filter((r) => !r.active)

  const row = (r: Recurring) => {
    const c = data.categoryById.get(r.categoryId ?? '')
    const card = r.type === 'transfer' ? data.accountById.get(r.toAccountId ?? '') : undefined
    const left = remainingPayments(r)
    const parts = [FREQ_LABELS[r.frequency]]
    if (r.active) parts.push(`próximo ${shortDate(r.nextDate)}`)
    else parts.push(r.endDate && r.nextDate > r.endDate ? 'terminado' : 'pausado')
    if (left !== null && r.active) parts.push(`quedan ${left} (${formatMoney(left * r.amount)})`)
    if (r.auto === false) parts.push('solo aviso')
    return (
      <button key={r.id} className={`row ${r.active ? '' : 'inactive'}`} onClick={() => setEditing(r)}>
        <span className="row-icon" style={{ background: `${c?.color ?? card?.color ?? '#8e8e93'}33` }}>
          {card ? '💳' : (c?.icon ?? '🔁')}
        </span>
        <span className="row-text">
          <span className="row-title">{r.note || c?.name || 'Pago'}</span>
          <span className="row-sub wrap">
            {parts.join(' · ')}
            {r.startDate && r.endDate && (
              <>
                <br />
                Del {shortDate(r.startDate)} al {shortDate(r.endDate)}
              </>
            )}
          </span>
        </span>
        <span className={`row-amount ${r.type === 'income' ? 'income' : ''}`}>{formatMoney(r.amount)}</span>
      </button>
    )
  }

  return (
    <>
      <section className="card">
        <div className="card-title">
          <span>Por pagar este mes</span>
          <strong>{formatMoney(leftThisMonth)}</strong>
        </div>
        <p className="hint">Suscripciones, pagos de tarjeta y otros pagos programados de los próximos 6 meses:</p>
        {perMonth.map((p) => (
          <div key={p.m} className="bar-row">
            <span className="bar-label">{monthLabel(p.m, true)} {p.m.slice(0, 4)}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(p.total / max) * 100}%`, background: 'var(--blue)' }} />
            </span>
            <span className="bar-value">{formatMoney(p.total)}</span>
          </div>
        ))}
      </section>

      <section className="card list-card">
        <div className="card-title">
          <span>Pagos programados</span>
        </div>
        {running.length === 0 ? <p className="empty">Agrega tus suscripciones, renta o pagos de tarjeta con su fecha de inicio y de fin.</p> : running.map(row)}
      </section>

      <button className="secondary-btn add-big" onClick={() => setEditing('new')}>
        + Nuevo pago programado
      </button>

      {stopped.length > 0 && (
        <section className="card list-card">
          <div className="card-title small">
            <span>Terminados o pausados</span>
          </div>
          {stopped.map(row)}
        </section>
      )}

      {editing && <PaymentSheet data={data} rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
