import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { db, newId, type Goal } from '../db'
import { centsToInput, dayLabel, formatMoney, parseToCents, todayISO } from '../format'
import type { AppData } from '../hooks'
import { Progress } from './Home'

const sumMoves = (g: Goal) => g.moves.reduce((s, m) => s + m.amount, 0)

function monthsUntil(iso: string): number {
  const now = new Date()
  const [y, m, d] = iso.split('-').map(Number)
  return Math.max(0, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()) + (d >= now.getDate() ? 0 : -1))
}

/** Ritmo: cuánto falta por mes y si el avance va por encima de una línea recta desde que se creó. */
function pace(g: Goal) {
  const saved = sumMoves(g)
  const missing = Math.max(0, g.target - saved)
  if (!g.targetDate || missing === 0) return { saved, missing }
  const months = monthsUntil(g.targetDate)
  const perMonth = Math.ceil(missing / Math.max(1, months + 1))
  const start = g.createdAt
  const end = new Date(g.targetDate).getTime()
  const expected = end > start ? (g.target * Math.min(1, (Date.now() - start) / (end - start))) : g.target
  return { saved, missing, perMonth, onTrack: saved >= expected, late: g.targetDate < todayISO() }
}

export function Goals({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [moving, setMoving] = useState<{ goal: Goal; sign: 1 | -1 } | null>(null)
  const active = data.goals.filter((g) => !g.done)
  const done = data.goals.filter((g) => g.done)
  const totalSaved = active.reduce((s, g) => s + sumMoves(g), 0)

  return (
    <>
      {data.goals.length === 0 ? (
        <section className="card">
          <p className="empty">Crea una meta (viaje, fondo de emergencia, auto) y ve apartando dinero hasta llegar.</p>
        </section>
      ) : (
        <section className="card">
          <div className="card-title">
            <span>Apartado en metas</span>
            <strong>{formatMoney(totalSaved)}</strong>
          </div>
          <p className="hint">Las aportaciones son apartados: no mueven dinero entre tus cuentas.</p>
        </section>
      )}

      {active.map((g) => {
        const p = pace(g)
        return (
          <section key={g.id} className="card goal">
            <button className="goal-head" onClick={() => setEditing(g)}>
              <span className="goal-icon">{g.icon}</span>
              <span className="row-text">
                <span className="row-title">{g.name}</span>
                <span className="row-sub">
                  {formatMoney(p.saved)} de {formatMoney(g.target)}
                  {g.targetDate && ` · para ${dayLabel(g.targetDate).toLowerCase()}`}
                </span>
              </span>
              <span className="goal-pct">{Math.min(100, Math.floor((p.saved / g.target) * 100))}%</span>
            </button>
            <Progress value={p.saved} max={g.target} />
            <p className={`hint ${p.missing === 0 ? 'income' : p.late ? 'expense' : ''}`}>
              {p.missing === 0
                ? '¡Meta cumplida!'
                : p.perMonth !== undefined
                  ? `${p.late ? 'Ya pasó la fecha. ' : ''}Aparta ${formatMoney(p.perMonth)} al mes para llegar${p.late ? '' : p.onTrack ? ' · vas a tiempo' : ' · vas atrasado'}`
                  : `Te faltan ${formatMoney(p.missing)}`}
            </p>
            <div className="btn-row">
              <button className="primary-btn" onClick={() => setMoving({ goal: g, sign: 1 })}>
                Aportar
              </button>
              <button className="secondary-btn" onClick={() => setMoving({ goal: g, sign: -1 })}>
                Retirar
              </button>
            </div>
          </section>
        )
      })}

      <button className="secondary-btn add-big" onClick={() => setEditing('new')}>
        + Nueva meta
      </button>

      {done.length > 0 && (
        <section className="card list-card">
          <div className="card-title small">
            <span>Cumplidas</span>
          </div>
          {done.map((g) => (
            <button key={g.id} className="row" onClick={() => setEditing(g)}>
              <span className="row-icon">{g.icon}</span>
              <span className="row-text">
                <span className="row-title">{g.name}</span>
              </span>
              <span className="row-amount income">{formatMoney(sumMoves(g))}</span>
            </button>
          ))}
        </section>
      )}

      {editing && <GoalSheet goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {moving && (
        <AmountSheet
          title={moving.sign > 0 ? `Aportar a ${moving.goal.name}` : `Retirar de ${moving.goal.name}`}
          onClose={() => setMoving(null)}
          onSave={async (amount, date) => {
            await db.goals.update(moving.goal.id, { moves: [...moving.goal.moves, { amount: amount * moving.sign, date }] })
          }}
        />
      )}
    </>
  )
}

function GoalSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? '🎯')
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '')
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [done, setDone] = useState(goal?.done ?? false)

  const save = async () => {
    const cents = parseToCents(target)
    if (!name.trim() || cents <= 0) return
    await db.goals.put({
      id: goal?.id ?? newId(),
      name: name.trim(),
      icon: [...icon.trim()].slice(0, 2).join('') || '🎯',
      target: cents,
      targetDate: targetDate || undefined,
      moves: goal?.moves ?? [],
      createdAt: goal?.createdAt ?? Date.now(),
      done,
    })
    onClose()
  }

  const remove = async () => {
    if (goal && confirm(`¿Borrar la meta "${goal.name}"?`)) {
      await db.goals.delete(goal.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={goal ? 'Editar meta' : 'Nueva meta'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>Nombre</span>
          <input value={name} placeholder="Ej. Viaje a Cancún" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Emoji</span>
          <input value={icon} className="emoji-input" onChange={(e) => setIcon(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Cantidad meta</span>
          <input inputMode="decimal" placeholder="$0" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Fecha objetivo</span>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </label>
        {goal && (
          <label className="form-row">
            <span>Marcar como cumplida</span>
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
          </label>
        )}
      </div>
      {goal && goal.moves.length > 0 && <MovesList moves={goal.moves} />}
      {goal && (
        <button className="danger-btn" onClick={remove}>
          Borrar meta
        </button>
      )}
    </Sheet>
  )
}

export function MovesList({ moves }: { moves: { amount: number; date: string }[] }) {
  return (
    <>
      <p className="hint">Historial</p>
      <div className="form-list">
        {[...moves].reverse().map((m, i) => (
          <div key={i} className="form-row">
            <span className="muted">{dayLabel(m.date)}</span>
            <span className={m.amount < 0 ? 'expense' : 'income'}>{formatMoney(m.amount)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function AmountSheet({ title, onClose, onSave }: { title: string; onClose: () => void; onSave: (cents: number, date: string) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const save = async () => {
    const cents = parseToCents(amount)
    if (cents <= 0) return
    await onSave(cents, date)
    onClose()
  }
  return (
    <Sheet
      title={title}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>Monto</span>
          <input inputMode="decimal" placeholder="$0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Fecha</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
    </Sheet>
  )
}
