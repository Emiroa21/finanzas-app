import { useRef, useState } from 'react'
import { db, newId, type RecurringFrequency, type Transaction, type TxType } from '../db'
import { FREQ_LABELS, recurringFrom } from '../recurring'
import { scanReceipt } from '../receipt'
import { centsToInput, formatMoney, parseToCents, todayISO } from '../format'
import { useStoredState, type AppData } from '../hooks'
import { Sheet } from './Sheet'
import { toast } from '../toast'
import { normalizeTag, photoToDataURL } from '../photo'

interface Props {
  data: AppData
  /** Movimiento a editar; vacío para uno nuevo. */
  tx?: Transaction
  /** Tipo con el que abre un movimiento nuevo. */
  initialType?: TxType
  onClose: () => void
}

const TYPES: [TxType, string][] = [
  ['expense', 'Gasto'],
  ['income', 'Ingreso'],
  ['transfer', 'Transferencia'],
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export function TxSheet({ data, tx, initialType, onClose }: Props) {
  const active = data.accounts.filter((a) => !a.archived)
  const [lastAccount, setLastAccount] = useStoredState('lastAccount', active[0]?.id ?? '')
  const [lastCategory, setLastCategory] = useStoredState<Record<string, string>>('lastCategory', {})

  const [type, setType] = useState<TxType>(tx?.type ?? initialType ?? 'expense')
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount) : '')
  const [accountId, setAccountId] = useState(tx?.accountId ?? (data.accountById.has(lastAccount) ? lastAccount : (active[0]?.id ?? '')))
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? active.find((a) => a.id !== accountId)?.id ?? '')
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? lastCategory[initialType === 'income' ? 'income' : 'expense'] ?? '')
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [repeat, setRepeat] = useState<RecurringFrequency | ''>('')
  const [installments, setInstallments] = useState(tx?.installments ? String(tx.installments) : '')
  const [error, setError] = useState('')
  const [more, setMore] = useState(!!(tx?.installments || tx?.tags?.length || tx?.photo))
  const [tags, setTags] = useState<string[]>(tx?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [photo, setPhoto] = useState<string | undefined>(tx?.photo)
  const [viewing, setViewing] = useState(false)
  const attachRef = useRef<HTMLInputElement>(null)
  const knownTags = (() => {
    const count = new Map<string, number>()
    for (const t of data.transactions) for (const g of t.tags ?? []) count.set(g, (count.get(g) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  })()
  const suggestions = knownTags.filter((g) => !tags.includes(g) && g.startsWith(normalizeTag(tagInput))).slice(0, 6)
  const addTag = (raw: string) => {
    const t = normalizeTag(raw)
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }
  const attach = async (file?: File) => {
    if (!file) return
    try {
      setPhoto(await photoToDataURL(file))
    } catch {
      setError('No se pudo leer la foto.')
    }
  }
  const [scanning, setScanning] = useState<number | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const onPhoto = async (file?: File) => {
    if (!file) return
    setError('')
    setScanning(0)
    try {
      photoToDataURL(file).then(setPhoto, () => undefined)
      const guess = await scanReceipt(file, setScanning)
      if (guess.amount) setAmount(centsToInput(guess.amount))
      if (guess.date) setDate(guess.date)
      if (guess.merchant) setNote(guess.merchant)
      const cat = guess.category && data.categories.find((c) => c.kind === 'expense' && c.name === guess.category)
      if (cat) setCategoryId(cat.id)
      if (!guess.amount) setError('No encontré el total; escríbelo con el teclado.')
    } catch {
      setError('No se pudo leer el ticket. Revisa tu conexión la primera vez que lo uses.')
    } finally {
      setScanning(null)
    }
  }

  const isCredit = data.accountById.get(accountId)?.type === 'credit'
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

    const finalTags = [...tags, normalizeTag(tagInput)].filter((t, i, a) => t && a.indexOf(t) === i)
    const record: Transaction = {
      id: tx?.id ?? newId(),
      type,
      amount: cents,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId,
      date,
      note: note.trim(),
      tags: finalTags.length ? finalTags : undefined,
      photo,
      createdAt: tx?.createdAt ?? Date.now(),
      recurringId: tx?.recurringId,
      installments: isCredit && type === 'expense' && Number(installments) > 1 ? Number(installments) : undefined,
    }
    if (repeat && !tx) {
      const rule = recurringFrom({ type, amount: cents, accountId, toAccountId: record.toAccountId, categoryId: record.categoryId, note: record.note, frequency: repeat }, date)
      record.recurringId = rule.id
      await db.recurring.add(rule)
    }
    await db.transactions.put(record)
    setLastAccount(accountId)
    if (type !== 'transfer') setLastCategory({ ...lastCategory, [type]: categoryId })
    onClose()
    const previous = tx
    const newRule = repeat && !tx ? record.recurringId : undefined
    toast(`${previous ? 'Cambios guardados' : `${TYPES.find((t) => t[0] === type)![1]} guardado`} · ${formatMoney(cents)}`, {
      label: 'Deshacer',
      run: async () => {
        if (previous) await db.transactions.put(previous)
        else await db.transactions.delete(record.id)
        if (newRule) await db.recurring.delete(newRule)
      },
    })
  }

  const remove = async () => {
    if (!tx) return
    await db.transactions.delete(tx.id)
    onClose()
    toast('Movimiento borrado', { label: 'Deshacer', run: () => db.transactions.put(tx).then(() => undefined) })
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

      {!tx && type === 'expense' && (
        <>
          <button className="scan-btn" onClick={() => photoRef.current?.click()} disabled={scanning !== null}>
            {scanning === null ? '📷 Escanear ticket' : `Leyendo ticket… ${Math.round(scanning * 100)}%`}
          </button>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </>
      )}

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
            <button
              key={c.id}
              className={`chip ${c.id === categoryId ? 'on' : ''}`}
              style={c.id === categoryId ? { borderColor: c.color, background: `${c.color}26` } : undefined}
              onClick={() => setCategoryId(c.id)}
            >
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

      <button className="more-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
        {more
          ? 'Menos opciones ▴'
          : `Más opciones ▾${repeat ? ` · ${FREQ_LABELS[repeat]}` : ''}${installments ? ` · ${installments} MSI` : ''}${tags.length ? ` · ${tags.length} etiqueta${tags.length > 1 ? 's' : ''}` : ''}${photo ? ' · 📎' : ''}`}
      </button>
      {more && (
        <div className="extras">
          <div className="tag-box">
            {tags.map((t) => (
              <button key={t} className="tag removable" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Quitar ${t}`}>
                #{t} ✕
              </button>
            ))}
            <input
              value={tagInput}
              placeholder={tags.length ? 'Otra etiqueta' : '# Etiquetas (viaje, trabajo…)'}
              enterKeyHint="done"
              onChange={(e) => {
                const v = e.target.value
                if (/[,\s]$/.test(v) && v.trim()) addTag(v)
                else setTagInput(v)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagInput)
                }
              }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="tag-suggest">
              {suggestions.map((g) => (
                <button key={g} className="tag" onClick={() => addTag(g)}>
                  + #{g}
                </button>
              ))}
            </div>
          )}
          <div className="photo-row">
            {photo ? (
              <>
                <button className="thumb" onClick={() => setViewing(true)} aria-label="Ver foto">
                  <img src={photo} alt="Foto del ticket" />
                </button>
                <button className="link" onClick={() => attachRef.current?.click()}>
                  Cambiar foto
                </button>
                <button className="link danger" onClick={() => setPhoto(undefined)}>
                  Quitar
                </button>
              </>
            ) : (
              <button className="secondary-btn small" onClick={() => attachRef.current?.click()}>
                📎 Adjuntar foto del ticket
              </button>
            )}
            <input ref={attachRef} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          </div>
          <div className="field-row">
            {!tx && (
              <label>
                <span>Repetir</span>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as RecurringFrequency | '')}>
                  <option value="">No se repite</option>
                  {Object.entries(FREQ_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isCredit && type === 'expense' && (
              <label>
                <span>Meses sin intereses</span>
                <select value={installments} onChange={(e) => setInstallments(e.target.value)}>
                  <option value="">De contado</option>
                  {[3, 6, 9, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} MSI
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
      {viewing && photo && (
        <div className="photo-viewer" onClick={() => setViewing(false)} role="dialog" aria-label="Foto del ticket">
          <img src={photo} alt="Foto del ticket" />
          <span>Toca para cerrar</span>
        </div>
      )}

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Borrar' : k}>
            {k}
          </button>
        ))}
      </div>

      <button className={`save-btn ${type}`} onClick={save}>
        {tx ? 'Guardar cambios' : `Guardar ${TYPES.find((t) => t[0] === type)![1].toLowerCase()}`}
        {cents > 0 && ` · ${formatMoney(cents)}`}
      </button>

      {tx && (
        <button className="danger-btn" onClick={remove}>
          Borrar movimiento
        </button>
      )}
    </Sheet>
  )
}
