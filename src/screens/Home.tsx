import { buildAlerts } from '../alerts'
import { useState } from 'react'
import { ConfirmPaymentSheet } from '../components/ConfirmPaymentSheet'
import { Sheet } from '../components/Sheet'
import { TxRow } from '../components/TxRow'
import { Wallet } from '../components/Wallet'
import type { Account, Transaction, TxType } from '../db'
import { currentMonth, dayLabel, formatMoney, monthLabel } from '../format'
import { monthTotals, useStoredState, type AppData } from '../hooks'
import { AccountSheet } from './Accounts'

interface Props {
  data: AppData
  onEdit: (tx: Transaction) => void
  onNew: (type: TxType) => void
  onSeeAll: () => void
  onBackup: () => void
  onPlan: () => void
}

const ACTIONS: [TxType | 'plan', string, string][] = [
  ['expense', 'Gasto', '↗'],
  ['income', 'Ingreso', '↙'],
  ['transfer', 'Transferir', '⇄'],
  ['plan', 'Planear', '▦'],
]

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function Home({ data, onEdit, onNew, onSeeAll, onBackup, onPlan }: Props) {
  const [hidden, setHidden] = useStoredState('hideBalance', false)
  const [lastBackup] = useStoredState<number | null>('lastBackup', null)
  const [userName, setUserName] = useStoredState('userName', '')
  const [profile, setProfile] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
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
  const urgent = alerts.some((a) => a.tone === 'danger' || a.tone === 'warn')

  return (
    <>
      <header className="greet">
        <div>
          <h1>{userName ? `Hola, ${userName}` : greeting()}</h1>
          <p>Cuidemos tu dinero.</p>
        </div>
        <button
          className="round-btn"
          aria-label={`Avisos: ${alerts.length}`}
          onClick={() => document.getElementById('avisos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          🔔{alerts.length > 0 && <span className={`dot ${urgent ? 'urgent' : ''}`} />}
        </button>
        <button className="avatar" aria-label="Tu perfil" onClick={() => setProfile(true)}>
          {userName ? userName.trim().charAt(0).toUpperCase() : '🙂'}
        </button>
      </header>

      <Wallet data={data} hidden={hidden} onToggleHidden={() => setHidden(!hidden)} onOpen={setEditing} />

      <section className="card actions">
        {ACTIONS.map(([id, label, icon]) => (
          <button key={id} onClick={() => (id === 'plan' ? onPlan() : onNew(id))}>
            <span className={`action-icon ${id}`}>{icon}</span>
            {label}
          </button>
        ))}
      </section>

      <section className="card month-card">
        <div>
          <span className="muted">Saldo total</span>
          <strong>{mask(total)}</strong>
        </div>
        <div>
          <span className="muted">Ingresos {monthLabel(month, true).toLowerCase()}</span>
          <strong className="income">{mask(totals.income)}</strong>
        </div>
        <div>
          <span className="muted">Gastos {monthLabel(month, true).toLowerCase()}</span>
          <strong className="expense">{mask(totals.expense)}</strong>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="card list-card" id="avisos">
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
          <span>Tus movimientos</span>
          {data.transactions.length > 0 && (
            <button className="link" onClick={onSeeAll}>
              Ver todos
            </button>
          )}
        </div>
        {data.transactions.length === 0 ? (
          <p className="empty">Aún no hay movimientos. Usa Gasto o Ingreso para registrar el primero.</p>
        ) : (
          data.transactions.slice(0, 8).map((t) => <TxRow key={t.id} tx={t} data={data} showDate onClick={() => onEdit(t)} />)
        )}
      </section>

      {paying && <ConfirmPaymentSheet data={data} rule={paying} onClose={() => setPayingId(null)} />}
      {editing && <AccountSheet data={data} account={editing} onClose={() => setEditing(null)} />}
      {profile && <ProfileSheet name={userName} onSave={setUserName} onClose={() => setProfile(false)} />}
    </>
  )
}

function ProfileSheet({ name, onSave, onClose }: { name: string; onSave: (n: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(name)
  return (
    <Sheet
      title="Tu perfil"
      onClose={onClose}
      action={
        <button
          className="link bold"
          onClick={() => {
            onSave(value.trim())
            onClose()
          }}
        >
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>¿Cómo te llamas?</span>
          <input value={value} placeholder="Tu nombre" maxLength={24} onChange={(e) => setValue(e.target.value)} />
        </label>
      </div>
      <p className="hint">Solo se usa para saludarte en Inicio y se queda en este iPhone.</p>
    </Sheet>
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
