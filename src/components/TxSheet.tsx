import { useState } from 'react'
import { db, newId, type Transaction, type TxType } from '../db'
import { centsToInput, formatMoney, parseToCents, todayISO } from '../format'
import { useStoredState, type AppData } from '../hooks'
import { Sheet } from './Sheet'

interface Props {
  data: AppData
  /** Movimiento a editar; vacío para uno nuevo. */
  tx?: Transaction
  onClose: () => void
}

const TYPES: [TxType, string][] = [
  ['expense', 'Gasto'],
  ['income', 'Ingreso'],
  ['transfer', 'Transferencia'],
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export function TxSheet({ data, tx, onClose }: Props) {
  const active = data.accounts.filter((a) => !a.archived)
  const [lastAccount, setLastAccount] = useStoredState('lastAccount', active[0]?.id ?? '')
  const [lastCategory, setLastCategory] = useStoredState<Record<string, string>>('lastCategory', {})

  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount) : '')
  const [accountId, setAccountId] = useState(tx?.accountId ?? (data.accountById.has(lastAccount) ? lastAccount : (active[0]?.id ?? '')))
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? active.find((a) => a.id !== accountId)?.id ?? '')
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? lastCategory.expense ?? '')
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [error, setError] = useState('')

  const categories = data.categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'))
  const cents = parseToCents(amount)

  const changeType = (t: TxType) => {
    setType(t)
    if (t !== 'transfer') {
      const kind = t === 'income' ? 'income' : 'expense'
      const current = data.categoryById.get(categoryId)
      if (current?.kind !== kind) setCategoryId(lastCategory[kind] ?? '')
    }
  }

  const press = (key: string) => {
    setError('')
    if (key === '⌫') return setAmount((a) => a.slice(0, -1))
    setAmount((a) => {
      if (key === '.' && a.includes('.')) return a
      if (a.includes('.') && a.split('.')[1].length >= 2) return a
      if (a.replace('.', '').length >= 10) return a
      if (a === '0' && key !== '.') return key
      return (a === '' && key === '.' ? '0' : a) + key
    })
  }

  const save = async () => {
    if (cents <= 0) return setError('Escribe un monto.')
    if (!accountId) return setError('Elige una cuenta.')
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Elige una cuenta destino distinta.')
    if (type !== 'transfer' && !categoryId) return setError('Elige una categoría.')

    const record: Transaction = {
      id: tx?.id ?? newId(),
      type,
      amount: cents,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId,
      date,
      note: note.trim(),
      createdAt: tx?.createdAt ?? Date.now(),
    }
    await db.transactions.put(record)
    setLastAccount(accountId)
    if (type !== 'transfer') setLastCategory({ ...lastCategory, [type]: categoryId })
    onClose()
  }

  const remove = async () => {
    if (tx && confirm('¿Borrar este movimiento?')) {
      await db.transactions.delete(tx.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={tx ? 'Editar movimiento' : 'Nuevo movimiento'}
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="segmented">
        {TYPES.map(([t, label]) => (
          <button key={t} className={t === type ? 'on' : ''} onClick={() => changeType(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className={`amount-display ${type}`}>{amount ? formatMoney(cents) : formatMoney(0)}</div>
      {error && <p className="error">{error}</p>}

      <div className="field-row">
        <label>
          <span>{type === 'transfer' ? 'De' : 'Cuenta'}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {type === 'transfer' ? (
          <label>
            <span>A</span>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </label>
        )}
      </div>

      {type !== 'transfer' && (
        <div className="chips scroll">
          {categories.map((c) => (
            <button key={c.id} className={`chip ${c.id === categoryId ? 'on' : ''}`} style={c.id === categoryId ? { borderColor: c.color, background: `${c.color}26` } : undefined} onClick={() => setCategoryId(c.id)}>
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="field-row">
        {type === 'transfer' && (
          <label>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </label>
        )}
        <label className="grow">
          <span>Nota</span>
          <input type="text" placeholder="Opcional" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Borrar' : k}>
            {k}
          </button>
        ))}
      </div>

      {tx && (
        <button className="danger-btn" onClick={remove}>
          Borrar movimiento
        </button>
      )}
    </Sheet>
  )
}
