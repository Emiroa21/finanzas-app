import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { db, newId, type Debt } from '../db'
import { centsToInput, dayLabel, formatMoney, parseToCents } from '../format'
import type { AppData } from '../hooks'
import { AmountSheet, MovesList } from './Goals'
import { Progress } from './Home'

const paidOf = (d: Debt) => d.payments.reduce((s, p) => s + p.amount, 0)

export function Debts({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)
  const open = data.debts.filter((d) => paidOf(d) < d.amount)
  const closed = data.debts.filter((d) => paidOf(d) >= d.amount)
  const total = (dir: Debt['direction']) => open.filter((d) => d.direction === dir).reduce((s, d) => s + d.amount - paidOf(d), 0)

  const group = (dir: Debt['direction'], title: string) => {
    const list = open.filter((d) => d.direction === dir)
    if (list.length === 0) return null
    return (
      <section className="card">
        <div className="card-title">
          <span>{title}</span>
          <strong className={dir === 'owe' ? 'expense' : 'income'}>{formatMoney(total(dir))}</strong>
        </div>
        {list.map((d) => {
          const paid = paidOf(d)
          return (
            <div key={d.id} className="debt">
              <button className="goal-head" onClick={() => setEditing(d)}>
                <span className="row-text">
                  <span className="row-title">{d.person}</span>
                  <span className="row-sub">{[d.note, d.dueDate && `para ${dayLabel(d.dueDate).toLowerCase()}`].filter(Boolean).join(' · ') || `de ${formatMoney(d.amount)}`}</span>
                </span>
                <span className="row-amount">{formatMoney(d.amount - paid)}</span>
              </button>
              <Progress value={paid} max={d.amount} />
              <div className="btn-row">
                <span className="hint">
                  {dir === 'owe' ? 'Pagado' : 'Cobrado'} {formatMoney(paid)} de {formatMoney(d.amount)}
                </span>
                <button className="link bold" onClick={() => setPaying(d)}>
                  {dir === 'owe' ? 'Abonar' : 'Registrar cobro'}
                </button>
              </div>
            </div>
          )
        })}
      </section>
    )
  }

  return (
    <>
      {open.length === 0 && (
        <section className="card">
          <p className="empty">Lleva el control de lo que debes y de lo que te deben, con sus abonos.</p>
        </section>
      )}
      {group('owe', 'Yo debo')}
      {group('owed', 'Me deben')}

      <button className="secondary-btn add-big" onClick={() => setEditing('new')}>
        + Nueva deuda o préstamo
      </button>

      {closed.length > 0 && (
        <section className="card list-card">
          <div className="card-title small">
            <span>Liquidadas</span>
          </div>
          {closed.map((d) => (
            <button key={d.id} className="row" onClick={() => setEditing(d)}>
              <span className="row-icon">{d.direction === 'owe' ? '🤝' : '📥'}</span>
              <span className="row-text">
                <span className="row-title">{d.person}</span>
              </span>
              <span className="row-amount muted">{formatMoney(d.amount)}</span>
            </button>
          ))}
        </section>
      )}

      {editing && <DebtSheet debt={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && (
        <AmountSheet
          title={paying.direction === 'owe' ? `Abono a ${paying.person}` : `Cobro a ${paying.person}`}
          onClose={() => setPaying(null)}
          onSave={async (amount, date) => {
            await db.debts.update(paying.id, { payments: [...paying.payments, { amount: Math.min(amount, paying.amount - paidOf(paying)), date }] })
          }}
        />
      )}
    </>
  )
}

function DebtSheet({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const [person, setPerson] = useState(debt?.person ?? '')
  const [direction, setDirection] = useState<Debt['direction']>(debt?.direction ?? 'owe')
  const [amount, setAmount] = useState(debt ? centsToInput(debt.amount) : '')
  const [note, setNote] = useState(debt?.note ?? '')
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '')

  const save = async () => {
    const cents = parseToCents(amount)
    if (!person.trim() || cents <= 0) return
    await db.debts.put({
      id: debt?.id ?? newId(),
      person: person.trim(),
      direction,
      amount: cents,
      note: note.trim(),
      dueDate: dueDate || undefined,
      payments: debt?.payments ?? [],
      createdAt: debt?.createdAt ?? Date.now(),
    })
    onClose()
  }

  const remove = async () => {
    if (debt && confirm(`¿Borrar la deuda con ${debt.person}?`)) {
      await db.debts.delete(debt.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={debt ? 'Editar deuda' : 'Nueva deuda'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="segmented two">
        <button className={direction === 'owe' ? 'on' : ''} onClick={() => setDirection('owe')}>
          Yo debo
        </button>
        <button className={direction === 'owed' ? 'on' : ''} onClick={() => setDirection('owed')}>
          Me deben
        </button>
      </div>
      <div className="form-list">
        <label className="form-row">
          <span>{direction === 'owe' ? 'A quién' : 'Quién'}</span>
          <input value={person} placeholder="Nombre o institución" onChange={(e) => setPerson(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Monto total</span>
          <input inputMode="decimal" placeholder="$0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Nota</span>
          <input value={note} placeholder="Opcional" onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Fecha acordada</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      {debt && debt.payments.length > 0 && <MovesList moves={debt.payments} />}
      {debt && (
        <button className="danger-btn" onClick={remove}>
          Borrar deuda
        </button>
      )}
    </Sheet>
  )
}
