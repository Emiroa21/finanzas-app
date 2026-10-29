import { useState } from 'react'
import { db, newId, type Recurring, type RecurringFrequency } from '../db'
import { centsToInput, dayLabel, parseToCents, todayISO } from '../format'
import type { AppData } from '../hooks'
import { FREQ_LABELS, firstFrom, nthDate } from '../recurring'
import { Sheet } from './Sheet'

type Kind = 'expense' | 'card' | 'income'
type Ends = 'never' | 'date' | 'count'

interface Props {
  data: AppData
  /** Pago a editar; vacío para uno nuevo. */
  rule?: Recurring
  onClose: () => void
}

/** Crear o editar un pago programado: suscripción, pago de tarjeta, renta, etc. */
export function PaymentSheet({ data, rule, onClose }: Props) {
  const active = data.accounts.filter((a) => !a.archived)
  const cards = active.filter((a) => a.type === 'credit')
  const isCard = rule?.type === 'transfer' && data.accountById.get(rule.toAccountId ?? '')?.type === 'credit'

  const [kind, setKind] = useState<Kind>(rule ? (rule.type === 'income' ? 'income' : rule.type === 'transfer' ? 'card' : 'expense') : 'expense')
  const [name, setName] = useState(rule?.note ?? '')
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amount) : '')
  const [accountId, setAccountId] = useState(rule?.accountId ?? active.find((a) => a.type === 'debit')?.id ?? active[0]?.id ?? '')
  const [cardId, setCardId] = useState(isCard ? rule!.toAccountId! : (cards[0]?.id ?? ''))
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? data.categories.find((c) => c.name === 'Suscripciones')?.id ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly')
  const [date, setDate] = useState(rule?.nextDate ?? todayISO())
  const [ends, setEnds] = useState<Ends>(rule?.endDate ? 'date' : 'never')
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [count, setCount] = useState('12')
  const [auto, setAuto] = useState(rule?.auto !== false)
  const [enabled, setEnabled] = useState(rule?.active ?? true)
  const [error, setError] = useState('')

  const categories = data.categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'))
  const lastDate = ends === 'count' && Number(count) > 0 ? nthDate(date, frequency, Math.round(Number(count))) : ends === 'date' ? endDate : ''

  const save = async () => {
    const cents = parseToCents(amount)
    if (!name.trim()) return setError('Ponle un nombre, por ejemplo "Netflix" o "Pago Visa".')
    if (cents <= 0) return setError('Escribe el monto.')
    if (kind === 'card' && !cardId) return setError('Primero crea tu tarjeta de crédito en Cuentas.')
    if (kind === 'card' && cardId === accountId) return setError('Elige la cuenta desde la que pagas.')
    if (kind !== 'card' && !categoryId) return setError('Elige una categoría.')
    if (lastDate && lastDate < date) return setError('La fecha de fin es antes del inicio.')

    const anchorDay = rule && rule.nextDate === date && rule.frequency === frequency ? rule.anchorDay : Number(date.slice(8))
    const record: Recurring = {
      id: rule?.id ?? newId(),
      type: kind === 'card' ? 'transfer' : kind,
      amount: cents,
      accountId,
      toAccountId: kind === 'card' ? cardId : undefined,
      categoryId: kind === 'card' ? undefined : categoryId,
      note: name.trim(),
      frequency,
      nextDate: rule ? date : firstFrom(date, frequency, anchorDay, todayISO()),
      anchorDay,
      active: enabled,
      startDate: rule?.startDate ?? date,
      endDate: lastDate || undefined,
      auto,
    }
    if (record.endDate && record.nextDate > record.endDate) record.active = false
    await db.recurring.put(record)
    onClose()
  }

  const remove = async () => {
    if (rule && confirm('¿Borrar este pago programado? Los movimientos que ya se registraron se quedan.')) {
      await db.recurring.delete(rule.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={rule ? 'Pago programado' : 'Nuevo pago programado'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="segmented">
        <button className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>
          Gasto
        </button>
        <button className={kind === 'card' ? 'on' : ''} onClick={() => setKind('card')}>
          Pago de tarjeta
        </button>
        <button className={kind === 'income' ? 'on' : ''} onClick={() => setKind('income')}>
          Ingreso
        </button>
      </div>
      <div className="spacer" />

      <div className="form-list">
        <label className="form-row">
          <span>Nombre</span>
          <input value={name} placeholder={kind === 'card' ? 'Ej. Pago Visa' : kind === 'income' ? 'Ej. Sueldo' : 'Ej. Netflix'} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Monto</span>
          <input inputMode="decimal" placeholder="$0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="form-row">
          <span>{kind === 'income' ? 'A la cuenta' : 'Desde la cuenta'}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {kind === 'card' ? (
          <label className="form-row">
            <span>Tarjeta</span>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.length === 0 && <option value="">Sin tarjetas</option>}
              {cards.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="form-row">
            <span>Categoría</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Elige…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-row">
          <span>Frecuencia</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            {Object.entries(FREQ_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="form-row">
          <span>{rule ? 'Próximo pago' : 'Fecha de inicio'}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Termina</span>
          <select value={ends} onChange={(e) => setEnds(e.target.value as Ends)}>
            <option value="never">Nunca</option>
            <option value="date">En una fecha</option>
            <option value="count">Después de N pagos</option>
          </select>
        </label>
        {ends === 'date' && (
          <label className="form-row">
            <span>Fecha de fin</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        )}
        {ends === 'count' && (
          <label className="form-row">
            <span>{rule ? 'Pagos que faltan' : 'Número de pagos'}</span>
            <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
        )}
        <label className="form-row">
          <span>Registrar solo</span>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        </label>
        {rule && (
          <label className="form-row">
            <span>Activo</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>
        )}
      </div>
      <p className="hint">
        {lastDate ? `Último pago: ${dayLabel(lastDate).toLowerCase()}.` : 'Se repite hasta que lo pauses o lo borres.'}{' '}
        {auto ? 'Cada pago se registra solo en su fecha.' : 'Solo se planea y te avisa; tú registras el pago.'}
      </p>
      {!rule && date < todayISO() && <p className="hint">Como la fecha de inicio ya pasó, solo se registrarán los pagos de hoy en adelante.</p>}
      {error && <p className="error">{error}</p>}
      {rule && (
        <button className="danger-btn" onClick={remove}>
          Borrar pago programado
        </button>
      )}
    </Sheet>
  )
}
