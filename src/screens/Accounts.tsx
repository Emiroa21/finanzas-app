import { useEffect, useRef, useState } from 'react'
import { exportCSV, exportJSON, importJSON } from '../backup'
import { ImportSheet } from '../components/ImportSheet'
import { Sheet } from '../components/Sheet'
import { ACCOUNT_TYPES, COLORS, db, newId, requestPersistence, type Account, type AccountType, type Category, type CategoryKind } from '../db'
import { cardStatus } from '../credit'
import { FREQ_LABELS } from '../recurring'
import type { Recurring, RecurringFrequency } from '../db'
import { centsToInput, dayLabel, formatMoney, parseToCents } from '../format'
import { disableLock, enableFaceId, faceIdAvailable, faceIdEnabled, lockEnabled, setPin } from '../lock'
import { useStoredState, type AppData } from '../hooks'

export function Accounts({ data }: { data: AppData }) {
  const [account, setAccount] = useState<Account | 'new' | null>(null)
  const [category, setCategory] = useState<Category | 'new' | null>(null)
  const [rule, setRule] = useState<Recurring | null>(null)
  const active = data.accounts.filter((a) => !a.archived)
  const archived = data.accounts.filter((a) => a.archived)
  const netWorth = active.reduce((s, a) => s + (data.balances.get(a.id) ?? 0), 0)

  return (
    <>
      <h1 className="title">Cuentas</h1>

      <section className="card list-card">
        <div className="card-title">
          <span>Patrimonio neto</span>
          <strong>{formatMoney(netWorth)}</strong>
        </div>
        {active.map((a) => (
          <AccountRow key={a.id} account={a} balance={data.balances.get(a.id) ?? 0} onClick={() => setAccount(a)} />
        ))}
        <button className="row add-row" onClick={() => setAccount('new')}>
          + Agregar cuenta
        </button>
      </section>

      {archived.length > 0 && (
        <section className="card list-card">
          <div className="card-title small">
            <span>Archivadas</span>
          </div>
          {archived.map((a) => (
            <AccountRow key={a.id} account={a} balance={data.balances.get(a.id) ?? 0} onClick={() => setAccount(a)} />
          ))}
        </section>
      )}

      <CreditCards data={data} onEdit={setAccount} />

      <section className="card list-card">
        <div className="card-title">
          <span>Pagos recurrentes</span>
        </div>
        {data.recurring.length === 0 ? (
          <p className="empty">Al registrar un movimiento elige "Repetir" para que se registre solo cada semana, quincena, mes o año.</p>
        ) : (
          data.recurring.map((r) => {
            const c = data.categoryById.get(r.categoryId ?? '')
            return (
              <button key={r.id} className={`row ${r.active ? '' : 'inactive'}`} onClick={() => setRule(r)}>
                <span className="row-icon" style={{ background: `${c?.color ?? '#8e8e93'}33` }}>
                  {r.type === 'transfer' ? '⇄' : (c?.icon ?? '•')}
                </span>
                <span className="row-text">
                  <span className="row-title">{r.note || c?.name || 'Transferencia'}</span>
                  <span className="row-sub">
                    {FREQ_LABELS[r.frequency]} · {r.active ? `próximo: ${dayLabel(r.nextDate).toLowerCase()}` : 'pausado'}
                  </span>
                </span>
                <span className={`row-amount ${r.type}`}>{formatMoney(r.amount)}</span>
              </button>
            )
          })
        )}
      </section>

      <section className="card list-card">
        <div className="card-title">
          <span>Categorías</span>
          <button className="link" onClick={() => setCategory('new')}>
            Agregar
          </button>
        </div>
        <div className="chips">
          {data.categories.map((c) => (
            <button key={c.id} className="chip" onClick={() => setCategory(c)}>
              <span>{c.icon}</span> {c.name}
              {c.kind === 'income' && <span className="tag">ingreso</span>}
            </button>
          ))}
        </div>
      </section>

      <SecurityCard />

      <BackupCard data={data} />

      <p className="footer-note">Tus datos viven solo en este iPhone. Haz un respaldo con frecuencia: si borras la app, se pierden.</p>

      {account && <AccountSheet data={data} account={account === 'new' ? undefined : account} onClose={() => setAccount(null)} />}
      {rule && <RecurringSheet rule={rule} onClose={() => setRule(null)} />}
      {category && <CategorySheet data={data} category={category === 'new' ? undefined : category} onClose={() => setCategory(null)} />}
    </>
  )
}

function AccountRow({ account, balance, onClick }: { account: Account; balance: number; onClick: () => void }) {
  return (
    <button className="row" onClick={onClick}>
      <span className="row-icon" style={{ background: `${account.color}33`, color: account.color }}>
        {account.name.charAt(0).toUpperCase()}
      </span>
      <span className="row-text">
        <span className="row-title">{account.name}</span>
        <span className="row-sub">{ACCOUNT_TYPES[account.type]}</span>
      </span>
      <span className={`row-amount ${balance < 0 ? 'expense' : ''}`}>{formatMoney(balance)}</span>
    </button>
  )
}

function RecurringSheet({ rule, onClose }: { rule: Recurring; onClose: () => void }) {
  const [amount, setAmount] = useState(centsToInput(rule.amount))
  const [note, setNote] = useState(rule.note)
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule.frequency)
  const [nextDate, setNextDate] = useState(rule.nextDate)
  const [active, setActive] = useState(rule.active)

  const save = async () => {
    const cents = parseToCents(amount)
    if (cents <= 0) return
    await db.recurring.update(rule.id, { amount: cents, note: note.trim(), frequency, nextDate, active, anchorDay: Number(nextDate.slice(8)) })
    onClose()
  }

  const remove = async () => {
    if (confirm('¿Borrar este pago recurrente? Los movimientos que ya se registraron se quedan.')) {
      await db.recurring.delete(rule.id)
      onClose()
    }
  }

  return (
    <Sheet
      title="Pago recurrente"
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
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Nota</span>
          <input value={note} placeholder="Ej. Netflix" onChange={(e) => setNote(e.target.value)} />
        </label>
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
          <span>Próxima fecha</span>
          <input type="date" value={nextDate} onChange={(e) => e.target.value && setNextDate(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Activo</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </label>
      </div>
      <button className="danger-btn" onClick={remove}>
        Borrar pago recurrente
      </button>
    </Sheet>
  )
}

const day = (v: string) => {
  const n = Math.round(Number(v))
  return n >= 1 && n <= 31 ? n : undefined
}

function CreditCards({ data, onEdit }: { data: AppData; onEdit: (a: Account) => void }) {
  const cards = data.accounts.filter((a) => a.type === 'credit' && !a.archived)
  if (cards.length === 0) return null
  return (
    <section className="card">
      <div className="card-title">
        <span>Tarjetas de crédito</span>
      </div>
      {cards.map((card) => {
        const st = cardStatus(card, data.transactions)
        return (
          <button key={card.id} className="credit-card" onClick={() => onEdit(card)}>
            <div className="card-title small">
              <span>{card.name}</span>
              <span className="muted">Debes {formatMoney(st?.debt ?? Math.max(0, -(data.balances.get(card.id) ?? 0)))}</span>
            </div>
            {st ? (
              <>
                <div className="credit-pay">
                  <span className="muted">Pago para no generar intereses</span>
                  <strong className={st.payNoInterest > 0 ? 'expense' : 'income'}>{st.payNoInterest > 0 ? formatMoney(st.payNoInterest) : 'Pagado'}</strong>
                  <span className="muted">antes del {dayLabel(st.due).toLowerCase()}</span>
                </div>
                <div className="credit-grid">
                  <span>
                    Corte: <b>{dayLabel(st.cutoff).toLowerCase()}</b>
                  </span>
                  {st.available !== undefined && (
                    <span>
                      Disponible: <b>{formatMoney(st.available)}</b>
                    </span>
                  )}
                  {st.monthlyInstallments > 0 && (
                    <span>
                      MSI al mes: <b>{formatMoney(st.monthlyInstallments)}</b>
                    </span>
                  )}
                  {st.pendingInstallments > 0 && (
                    <span>
                      MSI por cobrar: <b>{formatMoney(st.pendingInstallments)}</b>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="hint">Toca para agregar el día de corte y de pago, y ver cuánto pagar.</p>
            )}
          </button>
        )
      })}
      <p className="hint">Para registrar un pago, haz una transferencia desde tu cuenta de débito hacia la tarjeta.</p>
    </section>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {COLORS.map((c) => (
        <button key={c} aria-label={c} className={c === value ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}

function AccountSheet({ data, account, onClose }: { data: AppData; account?: Account; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'debit')
  const [initial, setInitial] = useState(account ? centsToInput(Math.abs(account.initialBalance)) : '')
  const [owes, setOwes] = useState(account ? account.initialBalance < 0 : false)
  const [color, setColor] = useState(account?.color ?? COLORS[data.accounts.length % COLORS.length])
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [cutoffDay, setCutoffDay] = useState(account?.cutoffDay ? String(account.cutoffDay) : '')
  const [dueDay, setDueDay] = useState(account?.dueDay ? String(account.dueDay) : '')
  const [limit, setLimit] = useState(account?.creditLimit ? centsToInput(account.creditLimit) : '')
  const used = account ? data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id) : false

  const save = async () => {
    if (!name.trim()) return
    const cents = parseToCents(initial)
    await db.accounts.put({
      id: account?.id ?? newId(),
      name: name.trim(),
      type,
      initialBalance: type === 'credit' || owes ? -cents : cents,
      color,
      archived,
      createdAt: account?.createdAt ?? Date.now(),
      ...(type === 'credit' ? { cutoffDay: day(cutoffDay), dueDay: day(dueDay), creditLimit: parseToCents(limit) || undefined } : {}),
    })
    onClose()
  }

  const remove = async () => {
    if (account && confirm(`¿Borrar la cuenta "${account.name}"?`)) {
      await db.accounts.delete(account.id)
      onClose()
    }
  }

  return (
    <Sheet
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
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
          <input value={name} placeholder="Ej. BBVA débito" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="form-row">
          <span>{type === 'credit' ? 'Deuda inicial' : 'Saldo inicial'}</span>
          <input inputMode="decimal" placeholder="$0" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </label>
        {type === 'credit' && (
          <>
            <label className="form-row">
              <span>Día de corte</span>
              <input inputMode="numeric" placeholder="Ej. 5" value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} />
            </label>
            <label className="form-row">
              <span>Día límite de pago</span>
              <input inputMode="numeric" placeholder="Ej. 25" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </label>
            <label className="form-row">
              <span>Límite de crédito</span>
              <input inputMode="decimal" placeholder="Opcional" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </>
        )}
        {type !== 'credit' && (
          <label className="form-row">
            <span>El saldo inicial es deuda</span>
            <input type="checkbox" checked={owes} onChange={(e) => setOwes(e.target.checked)} />
          </label>
        )}
        {account && (
          <label className="form-row">
            <span>Archivar</span>
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          </label>
        )}
      </div>
      <p className="hint">Color</p>
      <ColorPicker value={color} onChange={setColor} />
      {account &&
        (used ? (
          <p className="hint">Esta cuenta tiene movimientos. Puedes archivarla para ocultarla sin perder el historial.</p>
        ) : (
          <button className="danger-btn" onClick={remove}>
            Borrar cuenta
          </button>
        ))}
    </Sheet>
  )
}

function CategorySheet({ data, category, onClose }: { data: AppData; category?: Category; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '🏷️')
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense')
  const [color, setColor] = useState(category?.color ?? COLORS[data.categories.length % COLORS.length])
  const used = category ? data.transactions.some((t) => t.categoryId === category.id) : false

  const save = async () => {
    if (!name.trim()) return
    await db.categories.put({
      id: category?.id ?? newId(),
      name: name.trim(),
      icon: [...icon.trim()].slice(0, 2).join('') || '🏷️',
      kind,
      color,
      order: category?.order ?? data.categories.length,
    })
    onClose()
  }

  const remove = async () => {
    if (category && confirm(`¿Borrar la categoría "${category.name}"?`)) {
      await db.transaction('rw', db.categories, db.budgets, async () => {
        await db.categories.delete(category.id)
        await db.budgets.where('categoryId').equals(category.id).delete()
      })
      onClose()
    }
  }

  return (
    <Sheet
      title={category ? 'Editar categoría' : 'Nueva categoría'}
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
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Emoji</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className="emoji-input" />
        </label>
        <label className="form-row">
          <span>Tipo</span>
          <select value={kind} disabled={used} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
      </div>
      <p className="hint">Color</p>
      <ColorPicker value={color} onChange={setColor} />
      {category &&
        (used ? (
          <p className="hint">Esta categoría tiene movimientos, así que no se puede borrar.</p>
        ) : (
          <button className="danger-btn" onClick={remove}>
            Borrar categoría
          </button>
        ))}
    </Sheet>
  )
}

function SecurityCard() {
  const [enabled, setEnabled] = useState(lockEnabled)
  const [face, setFace] = useState(faceIdEnabled)
  const [canFace, setCanFace] = useState(false)
  const [settingPin, setSettingPin] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    faceIdAvailable().then(setCanFace)
  }, [])

  const turnOnFace = async () => {
    try {
      await enableFaceId()
      setFace(true)
      setMessage('Face ID activado.')
    } catch {
      setMessage('No se pudo activar Face ID. Puedes seguir usando tu PIN.')
    }
  }

  const turnOff = () => {
    if (confirm('¿Quitar el bloqueo de la app?')) {
      disableLock()
      setEnabled(false)
      setFace(false)
    }
  }

  return (
    <section className="card">
      <div className="card-title">
        <span>Seguridad</span>
        <span className="muted">{enabled ? (face ? 'PIN y Face ID' : 'PIN') : 'Sin bloqueo'}</span>
      </div>
      <p className="hint">La app pide tu PIN al abrirla y cuando vuelves después de 1 minuto.</p>
      <div className="btn-grid">
        {!enabled && (
          <button className="primary-btn" onClick={() => setSettingPin(true)}>
            Activar bloqueo con PIN
          </button>
        )}
        {enabled && !face && canFace && (
          <button className="primary-btn" onClick={turnOnFace}>
            Activar Face ID
          </button>
        )}
        {enabled && (
          <>
            <button className="secondary-btn" onClick={() => setSettingPin(true)}>
              Cambiar PIN
            </button>
            <button className="secondary-btn" onClick={turnOff}>
              Quitar bloqueo
            </button>
          </>
        )}
      </div>
      {message && <p className="hint">{message}</p>}
      {settingPin && (
        <PinSheet
          onClose={() => setSettingPin(false)}
          onSave={async (pin) => {
            await setPin(pin)
            setEnabled(true)
            setMessage(canFace && !face ? 'PIN guardado. También puedes activar Face ID.' : 'PIN guardado.')
          }}
        />
      )}
    </section>
  )
}

function PinSheet({ onClose, onSave }: { onClose: () => void; onSave: (pin: string) => Promise<void> }) {
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const save = async () => {
    if (!/^\d{4,6}$/.test(pin)) return setError('El PIN debe tener de 4 a 6 números.')
    if (pin !== confirmPin) return setError('Los PIN no coinciden.')
    await onSave(pin)
    onClose()
  }
  return (
    <Sheet
      title="PIN de la app"
      onClose={onClose}
      action={
        <button className="link bold" onClick={save}>
          Guardar
        </button>
      }
    >
      <div className="form-list">
        <label className="form-row">
          <span>Nuevo PIN</span>
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPinValue(e.target.value)} />
        </label>
        <label className="form-row">
          <span>Repetir PIN</span>
          <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="hint">No hay forma de recuperar el PIN. Si lo olvidas y no tienes Face ID, solo podrás volver a entrar borrando los datos, así que ten tu respaldo al día.</p>
    </Sheet>
  )
}

function BackupCard({ data }: { data: AppData }) {
  const count = data.transactions.length
  const [importing, setImporting] = useState(false)
  const [lastBackup] = useStoredState<number | null>('lastBackup', null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestPersistence().then(setPersisted)
  }, [])

  const onImport = async (file?: File) => {
    if (!file) return
    if (!confirm('Esto reemplaza todos tus datos actuales con los del respaldo. ¿Continuar?')) return
    try {
      const n = await importJSON(file)
      setMessage(`Respaldo cargado: ${n} movimientos.`)
    } catch (e) {
      setMessage((e as Error).message || 'No se pudo leer el archivo.')
    }
  }

  return (
    <section className="card">
      <div className="card-title">
        <span>Respaldo</span>
        <span className="muted">{count} movimientos</span>
      </div>
      <p className="hint">
        Último respaldo: {lastBackup ? new Date(lastBackup).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'nunca'}
        {persisted === false && ' · El almacenamiento aún no es permanente; instala la app en tu pantalla de inicio.'}
      </p>
      <div className="btn-grid">
        <button className="primary-btn" onClick={() => exportJSON().catch(() => setMessage('No se pudo exportar.'))}>
          Guardar respaldo
        </button>
        <button className="secondary-btn" onClick={() => exportCSV()}>
          Exportar CSV
        </button>
        <button className="secondary-btn" onClick={() => fileRef.current?.click()}>
          Restaurar respaldo
        </button>
        <button className="secondary-btn" onClick={() => setImporting(true)}>
          Importar estado de cuenta (CSV)
        </button>
      </div>
      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      {message && <p className="hint">{message}</p>}
    </section>
  )
}
