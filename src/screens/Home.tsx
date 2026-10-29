import { buildAlerts } from '../alerts'
import { useState } from 'react'
import { ConfirmPaymentSheet } from '../components/ConfirmPaymentSheet'
import { EyeIcon } from '../components/Icons'
import { TxRow } from '../components/TxRow'
import type { Transaction } from '../db'
import { currentMonth, dayLabel, formatMoney, monthLabel } from '../format'
import { monthTotals, useStoredState, type AppData } from '../hooks'

interface Props {
  data: AppData
  onEdit: (tx: Transaction) => void
  onSeeAll: () => void
  onBackup: () => void
}

export function Home({ data, onEdit, onSeeAll, onBackup }: Props) {
  const [hidden, setHidden] = useStoredState('hideBalance', false)
  const [lastBackup] = useStoredState<number | null>('lastBackup', null)
  const alerts = buildAlerts(data, lastBackup)
  const [payingId, setPayingId] = useState<string | null>(null)
  const paying = data.recurring.find((r) => r.id === payingId)
  const month = currentMonth()
  const totals = monthTotals(data.transactions, month)
  const total = data.accounts.filter((a) => !a.archived).reduce((sum, a) => sum + (data.balances.get(a.id) ?? 0), 0)
  const budgetTotal = data.budgets.reduce((s, b) => s + b.amount, 0)
  const budgetSpent = data.budgets.reduce((s, b) => s + (totals.byCategory.get(b.categoryId) ?? 0), 0)
  const top = [...totals.byCategory].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const mask = (cents: number) => (hidden ? '•••••' : formatMoney(cents))

  return (
    <>
      <h1 className="title">Inicio</h1>

      <section className="card hero">
        <div className="hero-top">
          <span className="muted">Saldo total</span>
          <button className="icon-btn" aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'} onClick={() => setHidden(!hidden)}>
            <EyeIcon off={hidden} />
          </button>
        </div>
        <div className="hero-amount">{mask(total)}</div>
        <div className="hero-split">
          <div>
            <span className="muted">Ingresos de {monthLabel(month, true)}</span>
            <strong className="income">{mask(totals.income)}</strong>
          </div>
          <div>
            <span className="muted">Gastos de {monthLabel(month, true)}</span>
            <strong className="expense">{mask(totals.expense)}</strong>
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="card list-card">
          <div className="card-title">
            <span>Próximos pagos y avisos</span>
          </div>
          {alerts.map((a) => (
            <button key={a.id} className={`row alert ${a.tone}`} onClick={a.id === 'backup' ? onBackup : a.ruleId ? () => setPayingId(a.ruleId!) : undefined}>
              <span className="row-icon">{a.icon}</span>
              <span className="row-text">
                <span className="row-title">{a.title}</span>
                <span className="row-sub">{[a.date && dayLabel(a.date), a.detail].filter(Boolean).join(' · ')}</span>
              </span>
              {a.amount !== undefined && <span className="row-amount">{mask(a.amount)}</span>}
            </button>
          ))}
        </section>
      )}

      {budgetTotal > 0 && (
        <section className="card">
          <div className="card-title">
            <span>Presupuesto del mes</span>
            <span className="muted">
              {formatMoney(budgetSpent)} de {formatMoney(budgetTotal)}
            </span>
          </div>
          <Progress value={budgetSpent} max={budgetTotal} />
        </section>
      )}

      {top.length > 0 && (
        <section className="card">
          <div className="card-title">
            <span>En qué se va tu dinero</span>
          </div>
          {top.map(([catId, amount]) => {
            const c = data.categoryById.get(catId)
            return (
              <div key={catId} className="bar-row">
                <span className="bar-label">
                  {c?.icon} {c?.name ?? 'Sin categoría'}
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(amount / top[0][1]) * 100}%`, background: c?.color }} />
                </span>
                <span className="bar-value">{formatMoney(amount)}</span>
              </div>
            )
          })}
        </section>
      )}

      <section className="card list-card">
        <div className="card-title">
          <span>Últimos movimientos</span>
          {data.transactions.length > 0 && (
            <button className="link" onClick={onSeeAll}>
              Ver todos
            </button>
          )}
        </div>
        {data.transactions.length === 0 ? (
          <p className="empty">Aún no hay movimientos. Toca el botón + para registrar el primero.</p>
        ) : (
          data.transactions.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} data={data} onClick={() => onEdit(t)} />)
        )}
      </section>

      {paying && <ConfirmPaymentSheet data={data} rule={paying} onClose={() => setPayingId(null)} />}
    </>
  )
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? value / max : 0
  const state = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok'
  return (
    <span className="progress">
      <span className={`progress-fill ${state}`} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
    </span>
  )
}
