import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { db, newId, type ChallengeKind, type Goal } from '../db'
import { CHALLENGES, cellAmount, challengeTotal, currentWeek, doneCells } from '../challenges'
import { toast } from '../toast'
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
  const expected = end > start ? g.target * Math.min(1, (Date.now() - start) / (end - start)) : g.target
  return { saved, missing, perMonth, onTrack: saved >= expected, late: g.targetDate < todayISO() }
}

export function Goals({ data }: { data: AppData }) {
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [moving, setMoving] = useState<{ goal: Goal; sign: 1 | -1 } | null>(null)
  const [challenge, setChallenge] = useState(false)
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
            {g.challenge ? (
              <ChallengeGrid goal={g} />
            ) : (
              <>
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
              </>
            )}
          </section>
        )
      })}

      <div className="btn-row add-big">
        <button className="secondary-btn" onClick={() => setEditing('new')}>
          + Nueva meta
        </button>
        <button className="secondary-btn" onClick={() => setChallenge(true)}>
          🏆 Reto de ahorro
        </button>
      </div>

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

      {challenge && <ChallengeSheet onClose={() => setChallenge(false)} />}
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

/** Cuadrícula de casillas del reto: tocar una la marca (aporta) o la desmarca. */
function ChallengeGrid({ goal }: { goal: Goal }) {
  const c = goal.challenge!
  const info = CHALLENGES[c.kind]
  const done = doneCells(goal)
  const today = todayISO()
  const week = currentWeek(c, today)
  const pendingNow = week !== null ? Array.from({ length: week + 1 }, (_, i) => i).filter((i) => !done.has(i)) : []

  const toggle = async (i: number) => {
    const fresh = await db.goals.get(goal.id)
    if (!fresh) return
    const key = `reto:${i}`
    const has = fresh.moves.some((m) => m.note === key)
    const moves = has ? fresh.moves.filter((m) => m.note !== key) : [...fresh.moves, { amount: cellAmount(c, i), date: today, note: key }]
    const filled = doneCells({ ...fresh, moves }).size === info.cells
    await db.goals.update(goal.id, { moves, done: filled })
    if (!has) toast(filled ? `🎉 ¡Completaste el reto ${goal.name}!` : `${info.weekly ? `Semana ${i + 1}` : `Sobre ${i + 1}`} · ${formatMoney(cellAmount(c, i))} apartados`)
  }

  return (
    <>
      <p className="hint">
        {done.size} de {info.cells} {info.weekly ? 'semanas' : 'sobres'}
        {week !== null && pendingNow.length > 0 && (
          <>
            {' · '}
            <span className={pendingNow.length > 1 ? 'expense' : ''}>
              {pendingNow.length > 1 ? `vas ${pendingNow.length - 1} semana${pendingNow.length > 2 ? 's' : ''} atrasado` : `esta semana te toca ${formatMoney(cellAmount(c, week))}`}
            </span>
          </>
        )}
        {week !== null && pendingNow.length === 0 && done.size < info.cells && ' · ¡vas al día!'}
      </p>
      <div className={`challenge-grid ${info.cells > 52 ? 'dense' : ''}`}>
        {Array.from({ length: info.cells }, (_, i) => (
          <button
            key={i}
            className={`cell ${done.has(i) ? 'done' : ''} ${i === week ? 'now' : ''}`}
            onClick={() => toggle(i)}
            aria-pressed={done.has(i)}
            aria-label={`${info.weekly ? 'Semana' : 'Sobre'} ${i + 1}: ${formatMoney(cellAmount(c, i))}`}
          >
            <span className="cell-n">{i + 1}</span>
            <span className="cell-v">${Math.round(cellAmount(c, i) / 100).toLocaleString('es-MX')}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function ChallengeSheet({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ChallengeKind>('weekly-up')
  const [base, setBase] = useState(centsToInput(CHALLENGES['weekly-up'].base))
  const [name, setName] = useState('')
  const info = CHALLENGES[kind]
  const cents = parseToCents(base)
  const total = challengeTotal(kind, cents)

  const pick = (k: ChallengeKind) => {
    setKind(k)
    setBase(centsToInput(CHALLENGES[k].base))
  }

  const save = async () => {
    if (cents <= 0) return
    const start = todayISO()
    const end = new Date(Date.parse(start) + (info.cells * 7 - 1) * 864e5).toISOString().slice(0, 10)
    await db.goals.add({
      id: newId(),
      name: name.trim() || `Reto ${info.name}`,
      icon: info.icon,
      target: total,
      targetDate: info.weekly ? end : undefined,
      moves: [],
      createdAt: Date.now(),
      done: false,
      challenge: { kind, base: cents, start },
    })
    onClose()
    toast('¡Reto creado! Marca cada casilla cuando apartes el dinero.')
  }

  return (
    <Sheet
      title="Reto de ahorro"
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Crear
        </button>
      }
    >
      <div className="challenge-kinds">
        {(Object.keys(CHALLENGES) as ChallengeKind[]).map((k) => (
          <button key={k} className={`kind ${k === kind ? 'on' : ''}`} onClick={() => pick(k)} aria-pressed={k === kind}>
            <span className="kind-icon">{CHALLENGES[k].icon}</span>
            <strong>{CHALLENGES[k].name}</strong>
          </button>
        ))}
      </div>
      <p className="hint">{info.desc}</p>
      <div className="form-list" style={{ marginTop: 12 }}>
        <label className="form-row">
          <span>Monto base</span>
          <input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Nombre</span>
          <input value={name} placeholder={`Reto ${info.name}`} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <section className="card challenge-total">
        <span className="muted">Al terminar tendrás</span>
        <strong>{formatMoney(total)}</strong>
        <span className="muted">
          {kind === 'weekly-up' && `Semana 1: ${formatMoney(cents)} · semana 52: ${formatMoney(cents * 52)}`}
          {kind === 'weekly-down' && `Semana 1: ${formatMoney(cents * 52)} · semana 52: ${formatMoney(cents)}`}
          {kind === 'envelopes' && `Sobres de ${formatMoney(cents)} a ${formatMoney(cents * 100)}`}
          {kind === 'fixed' && `${formatMoney(cents)} cada semana durante 52 semanas`}
        </span>
      </section>
      <button className="primary-btn" onClick={save}>
        Empezar reto
      </button>
    </Sheet>
  )
}
